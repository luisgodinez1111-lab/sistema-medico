import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldAdmission,assertAdmissionTransition,type FoldedAdmission,type AdmissionState}from"../../../packages/admission-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC AE — Ciclo de vida del internamiento: ADMITTED -> {TRANSFERRED*, DISCHARGED, CANCELLED}.
// Censo de hospitalización; admitir/trasladar/dar de alta/cancelar exige scope admission:write.
const AGG="Admission";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"admission:write",purpose:"TREATMENT"});
}

const AdmitBody=z.object({admissionId:z.string().uuid(),patientId:z.string().uuid(),unit:z.enum(["ER","WARD","ICU","OR","MATERNITY","PEDIATRICS"]),reason:z.string().min(1),occurredAt:z.string().datetime()});
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

async function loadForTransition(req:Request,admissionId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldAdmission(await readAggregateEvents(ctx,admissionId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Admission not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,admissionId:string,folded:FoldedAdmission,to:AdmissionState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:admissionId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertAdmissionTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({admissionId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const TransferBody=z.object({unit:z.enum(["ER","WARD","ICU","OR","MATERNITY","PEDIATRICS"]),occurredAt:z.string().datetime()});
export async function handleAdmissionTransfer(req:Request,admissionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,admissionId);const b=await parseJson(req,TransferBody);
  return await commit(ctx,idempotencyKey,expectedVersion,admissionId,folded,"TRANSFERRED","ADMISSION_TRANSFERRED",{kind:"TRANSFERRED",unit:b.unit},b.occurredAt,"admission.transferred");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const DischargeBody=z.object({disposition:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAdmissionDischarge(req:Request,admissionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,admissionId);const b=await parseJson(req,DischargeBody);
  return await commit(ctx,idempotencyKey,expectedVersion,admissionId,folded,"DISCHARGED","ADMISSION_DISCHARGED",{kind:"DISCHARGED",disposition:b.disposition},b.occurredAt,"admission.discharged");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAdmissionCancellation(req:Request,admissionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,admissionId);const b=await parseJson(req,CancelBody);
  return await commit(ctx,idempotencyKey,expectedVersion,admissionId,folded,"CANCELLED","ADMISSION_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"admission.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
