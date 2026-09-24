import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldAllergy,assertAllergyTransition,type FoldedAllergy,type AllergyState}from"../../../packages/allergy-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC R — Ciclo de vida de la alergia: RECORDED(ACTIVE) -> REFUTED / INACTIVE; INACTIVE -> ACTIVE.
const AGG="Allergy";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"allergy:write",purpose:"TREATMENT"});
}
export const CreateBody=z.object({allergyId:z.string().uuid(),patientId:z.string().uuid(),substance:z.string().min(1),severity:z.enum(["MILD","MODERATE","SEVERE"]),reaction:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAllergyCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.allergyId,expectedVersion:0,eventType:"ALLERGY_RECORDED",payload:{kind:"RECORDED",patientId:b.patientId,substance:b.substance,severity:b.severity,reaction:b.reaction},occurredAt:b.occurredAt,topic:"allergy.recorded"});
  const result=await runClinicalCommand(ctx,cmd);const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({allergyId:b.allergyId,state:"ACTIVE",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
async function loadForTransition(req:Request,allergyId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldAllergy(await readAggregateEvents(ctx,allergyId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Allergy not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,allergyId:string,folded:FoldedAllergy,to:AllergyState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:allergyId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertAllergyTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({allergyId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}
export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleAllergyRefutation(req:Request,allergyId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,allergyId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,allergyId,folded,"REFUTED","ALLERGY_REFUTED",{kind:"REFUTED"},b.occurredAt,"allergy.refuted");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleAllergyInactivation(req:Request,allergyId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,allergyId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,allergyId,folded,"INACTIVE","ALLERGY_INACTIVATED",{kind:"INACTIVATED"},b.occurredAt,"allergy.inactivated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleAllergyReactivation(req:Request,allergyId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,allergyId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,allergyId,folded,"ACTIVE","ALLERGY_REACTIVATED",{kind:"REACTIVATED"},b.occurredAt,"allergy.reactivated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
