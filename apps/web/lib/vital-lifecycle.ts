import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldVital,assertVitalTransition,type FoldedVital,type VitalState}from"../../../packages/vital-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC W — Ciclo de vida de una observación de signo vital: RECORDED -> {AMENDED, ENTERED_IN_ERROR}.
// El valor vigente es append-only: cada corrección genera un evento nuevo (scope vital:write).
const AGG="VitalSign";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"vital:write",purpose:"TREATMENT"});
}

const RecordBody=z.object({vitalId:z.string().uuid(),patientId:z.string().uuid(),vitalType:z.enum(["BP","HR","TEMP","SPO2","WEIGHT","HEIGHT","RESP"]),value:z.string().min(1),unit:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleVitalRecord(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,RecordBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.vitalId,expectedVersion:0,eventType:"VITAL_RECORDED",payload:{kind:"RECORDED",patientId:b.patientId,vitalType:b.vitalType,value:b.value,unit:b.unit},occurredAt:b.occurredAt,topic:"vital.recorded"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({vitalId:b.vitalId,state:"RECORDED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,vitalId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldVital(await readAggregateEvents(ctx,vitalId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Vital sign not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,vitalId:string,folded:FoldedVital,to:VitalState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:vitalId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertVitalTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({vitalId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const AmendBody=z.object({value:z.string().min(1),unit:z.string().min(1),reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleVitalAmendment(req:Request,vitalId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,vitalId);const b=await parseJson(req,AmendBody);
  return await commit(ctx,idempotencyKey,expectedVersion,vitalId,folded,"AMENDED","VITAL_AMENDED",{kind:"AMENDED",value:b.value,unit:b.unit,reason:b.reason},b.occurredAt,"vital.amended");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const ErrorBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleVitalErrorMark(req:Request,vitalId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,vitalId);const b=await parseJson(req,ErrorBody);
  return await commit(ctx,idempotencyKey,expectedVersion,vitalId,folded,"ENTERED_IN_ERROR","VITAL_ENTERED_IN_ERROR",{kind:"ENTERED_IN_ERROR",reason:b.reason},b.occurredAt,"vital.entered_in_error");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
