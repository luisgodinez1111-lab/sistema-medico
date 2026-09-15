import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldMedication,assertMedicationTransition,type FoldedMedication}from"../../../packages/medication-fold/src";
import{type MedicationState}from"../../../packages/medication-domain/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC H — Ciclo de vida de medicación sobre el kernel. Physician Control como estrella:
// PROPOSE lo puede hacer cualquier clínico (o la IA), pero PRESCRIBE (la orden firmada) EXIGE
// médico humano — la IA nunca prescribe. Luego ACTIVATE y DISCONTINUE (con razón).
const AGG="Medication";
type Claims={sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string};

const ProposeBody=z.object({medicationId:z.string().uuid(),patientId:z.string().uuid(),drugCode:z.string().min(1),dose:z.string().min(1),route:z.string().min(1),frequency:z.string().min(1),occurredAt:z.string().datetime()});
// PROPOSE = creación. Cualquier clínico con scope medication:propose (no exige ser médico).
export async function handleMedicationProposal(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"medication:propose",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ProposeBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.medicationId,expectedVersion:0,eventType:"MEDICATION_PROPOSED",payload:{kind:"PROPOSED",patientId:b.patientId,drugCode:b.drugCode,dose:b.dose,route:b.route,frequency:b.frequency},occurredAt:b.occurredAt,topic:"medication.proposed"});
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
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,"PRESCRIBED","MEDICATION_PRESCRIBED",{kind:"PRESCRIBED",prescriberId:claims.sub},b.occurredAt,"medication.prescribed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// ACTIVATE = PRESCRIBED -> ACTIVE (inicio de administración).
export async function handleMedicationActivation(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,WhenBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,"ACTIVE","MEDICATION_ACTIVATED",{kind:"ACTIVATED"},b.occurredAt,"medication.activated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// DISCONTINUE = {ACTIVE,HELD} -> STOPPED. Exige razón del cambio (trazabilidad clínica).
const StopBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleMedicationDiscontinuation(req:Request,medicationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,medicationId,true);
  const b=await parseJson(req,StopBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,medicationId,folded,"STOPPED","MEDICATION_STOPPED",{kind:"STOPPED",reason:b.reason},b.occurredAt,"medication.stopped");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
