import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldSpecimen,assertSpecimenTransition,type FoldedSpecimen,type SpecimenState}from"../../../packages/specimen-fold/src";
import{runClinicalCommand,lookupReplay,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC AF — Ciclo de vida de una muestra: COLLECTED -> IN_TRANSIT -> RECEIVED -> {RESULTED, REJECTED}.
// Cadena de custodia pre-analítica; recolectar/enviar/recibir/procesar/rechazar exige scope specimen:write.
const AGG="Specimen";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"specimen:write",purpose:"TREATMENT"});
}

export const CollectBody=z.object({specimenId:z.string().uuid(),patientId:z.string().uuid(),specimenType:z.enum(["BLOOD","URINE","TISSUE","SWAB","CSF","STOOL"]),orderId:z.string().uuid().optional(),occurredAt:z.string().datetime()});
export async function handleSpecimenCollect(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CollectBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.specimenId,expectedVersion:0,eventType:"SPECIMEN_COLLECTED",payload:{kind:"COLLECTED",patientId:b.patientId,specimenType:b.specimenType,orderId:b.orderId??""},occurredAt:b.occurredAt,topic:"specimen.collected"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({specimenId:b.specimenId,state:"COLLECTED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedSpecimen,SpecimenState>({aggregateType:AGG,idKey:"specimenId",notFound:"Specimen not found",fold:foldSpecimen,assertTransition:assertSpecimenTransition,authz});
const loadForTransition=(req:Request,specimenId:string)=>LIFECYCLE.loadForTransition(req,specimenId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,specimenId:string,folded:FoldedSpecimen,to:SpecimenState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,specimenId,folded,to,eventType,payload,occurredAt,topic);

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleSpecimenTransit(req:Request,specimenId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,specimenId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,specimenId,folded,"IN_TRANSIT","SPECIMEN_IN_TRANSIT",{kind:"IN_TRANSIT"},b.occurredAt,"specimen.in_transit");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleSpecimenReceipt(req:Request,specimenId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,specimenId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,specimenId,folded,"RECEIVED","SPECIMEN_RECEIVED",{kind:"RECEIVED"},b.occurredAt,"specimen.received");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleSpecimenResult(req:Request,specimenId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,specimenId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,specimenId,folded,"RESULTED","SPECIMEN_RESULTED",{kind:"RESULTED"},b.occurredAt,"specimen.resulted");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const RejectBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleSpecimenRejection(req:Request,specimenId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,specimenId);const b=await parseJson(req,RejectBody);
  return await commit(ctx,idempotencyKey,expectedVersion,specimenId,folded,"REJECTED","SPECIMEN_REJECTED",{kind:"REJECTED",reason:b.reason},b.occurredAt,"specimen.rejected");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
