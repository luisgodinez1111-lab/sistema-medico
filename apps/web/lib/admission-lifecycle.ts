import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldAdmission,assertAdmissionTransition,type FoldedAdmission,type AdmissionState}from"../../../packages/admission-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC AE — Ciclo de vida del internamiento: ADMITTED -> {TRANSFERRED*, DISCHARGED, CANCELLED}.
// Censo de hospitalización; admitir/trasladar/dar de alta/cancelar exige scope admission:write.
const AGG="Admission";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"admission:write",purpose:"TREATMENT"});
}

export const AdmitBody=z.object({admissionId:z.string().uuid(),patientId:z.string().uuid(),unit:z.enum(["ER","WARD","ICU","OR","MATERNITY","PEDIATRICS"]),reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAdmissionAdmit(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,AdmitBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.admissionId,expectedVersion:0,eventType:"ADMISSION_ADMITTED",payload:{kind:"ADMITTED",patientId:b.patientId,unit:b.unit,reason:b.reason},occurredAt:b.occurredAt,topic:"admission.admitted"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({admissionId:b.admissionId,state:"ADMITTED",unit:b.unit,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedAdmission,AdmissionState>({aggregateType:AGG,idKey:"admissionId",notFound:"Admission not found",fold:foldAdmission,assertTransition:assertAdmissionTransition,authz});
const loadForTransition=(req:Request,admissionId:string)=>LIFECYCLE.loadForTransition(req,admissionId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,admissionId:string,folded:FoldedAdmission,to:AdmissionState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,admissionId,folded,to,eventType,payload,occurredAt,topic);

export const TransferBody=z.object({unit:z.enum(["ER","WARD","ICU","OR","MATERNITY","PEDIATRICS"]),occurredAt:z.string().datetime()});
export async function handleAdmissionTransfer(req:Request,admissionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,admissionId);const b=await parseJson(req,TransferBody);
  return await commit(ctx,idempotencyKey,expectedVersion,admissionId,folded,"TRANSFERRED","ADMISSION_TRANSFERRED",{kind:"TRANSFERRED",unit:b.unit},b.occurredAt,"admission.transferred");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const DischargeBody=z.object({disposition:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAdmissionDischarge(req:Request,admissionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,admissionId);const b=await parseJson(req,DischargeBody);
  return await commit(ctx,idempotencyKey,expectedVersion,admissionId,folded,"DISCHARGED","ADMISSION_DISCHARGED",{kind:"DISCHARGED",disposition:b.disposition},b.occurredAt,"admission.discharged");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAdmissionCancellation(req:Request,admissionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,admissionId);const b=await parseJson(req,CancelBody);
  return await commit(ctx,idempotencyKey,expectedVersion,admissionId,folded,"CANCELLED","ADMISSION_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"admission.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
