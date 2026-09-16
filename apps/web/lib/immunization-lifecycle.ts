import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldImmunization,assertImmunizationTransition,type FoldedImmunization,type ImmunizationState}from"../../../packages/immunization-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC V — Ciclo de vida de una vacuna: DUE -> {ADMINISTERED, REFUSED}; ADMINISTERED -> ADVERSE_EVENT.
// Enfermería/médico registran la cartilla (scope immunization:write).
const AGG="Immunization";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"immunization:write",purpose:"TREATMENT"});
}

const DueBody=z.object({immunizationId:z.string().uuid(),patientId:z.string().uuid(),vaccineCode:z.string().min(1),dose:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImmunizationDue(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,DueBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.immunizationId,expectedVersion:0,eventType:"IMMUNIZATION_DUE",payload:{kind:"DUE",patientId:b.patientId,vaccineCode:b.vaccineCode,dose:b.dose},occurredAt:b.occurredAt,topic:"immunization.due"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({immunizationId:b.immunizationId,state:"DUE",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,immunizationId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldImmunization(await readAggregateEvents(ctx,immunizationId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Immunization not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,immunizationId:string,folded:FoldedImmunization,to:ImmunizationState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:immunizationId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertImmunizationTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({immunizationId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const AdminBody=z.object({lot:z.string().min(1),site:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImmunizationAdministration(req:Request,immunizationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,immunizationId);const b=await parseJson(req,AdminBody);
  return await commit(ctx,idempotencyKey,expectedVersion,immunizationId,folded,"ADMINISTERED","IMMUNIZATION_ADMINISTERED",{kind:"ADMINISTERED",lot:b.lot,site:b.site},b.occurredAt,"immunization.administered");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImmunizationRefusal(req:Request,immunizationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,immunizationId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,immunizationId,folded,"REFUSED","IMMUNIZATION_REFUSED",{kind:"REFUSED",reason:b.reason},b.occurredAt,"immunization.refused");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const AdverseBody=z.object({reaction:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImmunizationAdverseEvent(req:Request,immunizationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,immunizationId);const b=await parseJson(req,AdverseBody);
  return await commit(ctx,idempotencyKey,expectedVersion,immunizationId,folded,"ADVERSE_EVENT","IMMUNIZATION_ADVERSE_EVENT",{kind:"ADVERSE_EVENT",reaction:b.reaction},b.occurredAt,"immunization.adverse_event");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
