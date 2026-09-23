import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldWound,assertWoundTransition,type FoldedWound,type WoundState}from"../../../packages/wound-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC AI — Ciclo de vida de una herida/UPP: OPEN -> {OPEN (re-valoración), HEALED, ESCALATED}.
// Cuidado de heridas; documentar/re-valorar/cerrar/escalar exige scope wound:write.
const AGG="Wound";
const STAGES=["STAGE_1","STAGE_2","STAGE_3","STAGE_4","UNSTAGEABLE","DTI"] as const;
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"wound:write",purpose:"TREATMENT"});
}

export const DocumentBody=z.object({woundId:z.string().uuid(),patientId:z.string().uuid(),location:z.enum(["SACRUM","HEEL","ISCHIUM","TROCHANTER","OCCIPUT","ELBOW","OTHER"]),stage:z.enum(STAGES),occurredAt:z.string().datetime()});
export async function handleWoundDocument(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,DocumentBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.woundId,expectedVersion:0,eventType:"WOUND_DOCUMENTED",payload:{kind:"DOCUMENTED",patientId:b.patientId,location:b.location,stage:b.stage},occurredAt:b.occurredAt,topic:"wound.documented"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({woundId:b.woundId,state:"OPEN",stage:b.stage,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,woundId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldWound(await readAggregateEvents(ctx,woundId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Wound not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,woundId:string,folded:FoldedWound,to:WoundState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:woundId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertWoundTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({woundId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

export const ReassessBody=z.object({stage:z.enum(STAGES),occurredAt:z.string().datetime()});
export async function handleWoundReassessment(req:Request,woundId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,woundId);const b=await parseJson(req,ReassessBody);
  return await commit(ctx,idempotencyKey,expectedVersion,woundId,folded,"OPEN","WOUND_REASSESSED",{kind:"REASSESSED",stage:b.stage},b.occurredAt,"wound.reassessed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleWoundHealing(req:Request,woundId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,woundId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,woundId,folded,"HEALED","WOUND_HEALED",{kind:"HEALED"},b.occurredAt,"wound.healed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleWoundEscalation(req:Request,woundId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,woundId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,woundId,folded,"ESCALATED","WOUND_ESCALATED",{kind:"ESCALATED",reason:b.reason},b.occurredAt,"wound.escalated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
