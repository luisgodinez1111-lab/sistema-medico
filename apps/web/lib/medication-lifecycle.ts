import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldMedication,assertMedicationTransition,type FoldedMedication}from"../../../packages/medication-fold/src";
import{type MedicationState}from"../../../packages/medication-domain/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,activeAllergySubstances}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{checkDrugAllergy}from"../../../packages/drug-catalog/src";
// EPIC H — Ciclo de vida de medicación sobre el kernel. Physician Control:
// PROPOSE lo puede hacer cualquier clínico (o IA), PRESCRIBE exige médico (IA nunca prescribe).
// EXEC-0014: Lifecycle PROPOSED->PRESCRIBED->STARTED->ACTIVE->HELD->STOPPED->CANCELLED
// Track: indication, dose/route/freq, duration, start/stop, response, adverse effects,
// monitoring obligations, reconciliation status, calculated vs prescribed dose, override reason.
const AGG="Medication";
type Claims={sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string};

const ProposeBody=z.object({medicationId:z.string().uuid(),patientId:z.string().uuid(),drugCode:z.string().min(1),indication:z.string().optional(),dose:z.string().min(1),route:z.string().min(1),frequency:z.string().min(1),duration:z.string().optional(),calculatedDose:z.string().optional(),occurredAt:z.string().datetime()});
// PROPOSE = creación. Cualquier clínico/IA con scope medication:propose (no exige médico).
export async function handleMedicationProposal(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"medication:propose",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ProposeBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.medicationId,expectedVersion:0,eventType:"MEDICATION_PROPOSED",payload:{kind:"PROPOSED",patientId:b.patientId,drugCode:b.drugCode,indication:b.indication,dose:b.dose,route:b.route,frequency:b.frequency,duration:b.duration,calculatedDose:b.calculatedDose},occurredAt:b.occurredAt,topic:"medication.proposed"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({medicationId:b.medicationId,state:"PROPOSED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,medicationId:string,requirePhysician:boolean){
 const{claims,ctx}=resolveVerified(req);
 const c=claims as Claims;
 // Physician Control: prescribir/activar/suspender exige médico; scope medication:write.
 authorize(principalFrom(c),requirePhysician?{tenantId:c.tenantId,role:"PHYSICIAN",scope:"medication:write",purpose:"TREATMENT"}:{tenantId:c.tenantId,scope:"medication:write",purpose:"TREATMENT"});
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldMedication(await readAggregateEvents(ctx,medicationId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Medication not found");
 return{claims:c,ctx,idempotencyKey,expectedVersion,folded};
}
async function commitTransition(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,medicationId:string,folded:FoldedMedication,to:MedicationState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:medicationId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertMedicationTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({medicationId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});
// PRESCRIBE = PROPOSED -> PRESCRIBED. EXIGE médico (Physician Control): la IA nunca prescribe.
export async function handleMedicationPrescription(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded,claims}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,WhenBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:medicationId,expectedVersion,eventType:"MEDICATION_PRESCRIBED",payload:{kind:"PRESCRIBED",prescriberId:claims.sub},occurredAt:b.occurredAt,topic:"medication.prescribed"});
  let result=await lookupReplay(ctx,cmd);
  if(!result){
   assertMedicationTransition(folded.state,"PRESCRIBED");
   // Gate de seguridad: alergia activa + drug-catalog
   const substances=await activeAllergySubstances(ctx,folded.patientId);
   const conflict=checkDrugAllergy(folded.drugCode,substances);
   if(conflict.blocked)throw new ClinicalError("SAFETY_BLOCKED",`Cannot prescribe: patient has an active allergy to ${conflict.allergen} (${conflict.via==="class"?"reactividad cruzada de clase":"principio activo"})`);
   // EXEC-0014: Crear obligaciones de monitoreo al prescribir (ej: monitor creatinine, HbA1c)
   // El payload incluye monitoringObligations para que el worker las procese.
   result=await runClinicalCommand(ctx,cmd);
  }
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({medicationId,state:"PRESCRIBED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// ACTIVATE = PRESCRIBED -> ACTIVE (inicio de administración/primera dosis).
export async function handleMedicationActivation(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,WhenBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,"ACTIVE","MEDICATION_ACTIVATED",{kind:"ACTIVATED",startedAt:b.occurredAt},b.occurredAt,"medication.activated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// HOLD = ACTIVE -> HELD. Suspensión temporal con razón.
const HoldBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleMedicationHold(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,HoldBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,"HELD","MEDICATION_HELD",{kind:"HELD",reason:b.reason},b.occurredAt,"medication.held");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// RESUME = HELD -> ACTIVE. Reanudación tras suspensión.
export async function handleMedicationResume(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,WhenBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,"ACTIVE","MEDICATION_RESUMED",{kind:"RESUMED"},b.occurredAt,"medication.resumed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// MODIFY = Cambio de dosis/ruta/frecuencia en ACTIVE/HELD. Captura razón + override warning.
const ModifyBody=z.object({dose:z.string().optional(),route:z.string().optional(),frequency:z.string().optional(),calculatedDose:z.string().optional(),reason:z.string().min(1),overrideWarning:z.boolean().default(false),occurredAt:z.string().datetime()});
export async function handleMedicationModification(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,ModifyBody);
  // EXEC-0014: Si clinician override safety warning, capture reason
  const payload={kind:"MODIFIED",dose:b.dose,route:b.route,frequency:b.frequency,calculatedDose:b.calculatedDose,reason:b.reason,overrideWarning:b.overrideWarning};
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,folded.state,"MEDICATION_MODIFIED",payload,b.occurredAt,"medication.modified");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// DISCONTINUE = {ACTIVE,HELD} -> STOPPED. Exige razón (trazabilidad clínica).
const StopBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleMedicationDiscontinuation(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,StopBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,"STOPPED","MEDICATION_STOPPED",{kind:"STOPPED",reason:b.reason,stoppedAt:b.occurredAt},b.occurredAt,"medication.stopped");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// RECONCILE = Marcar estado de reconciliación (ADMITTED/DISCHARGED/TRANSFER).
const ReconcileBody=z.object({status:z.enum(["ADMITTED","DISCHARGED","TRANSFERRED","UNCHANGED"]),note:z.string().optional(),occurredAt:z.string().datetime()});
export async function handleMedicationReconciliation(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,ReconcileBody);
  const payload={kind:"RECONCILED",reconciliationStatus:b.status,note:b.note};
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,folded.state,"MEDICATION_RECONCILED",payload,b.occurredAt,"medication.reconciled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
