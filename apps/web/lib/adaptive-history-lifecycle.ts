// ⚠️ NOT_WIRED (endurecimiento G / Epic BF): este handler NO está cableado a ninguna ruta (código inalcanzable).
// Ver docs/adjudication/not-wired-registry.json. R6 (IA) EN PAUSA: no activar. No cuenta como capacidad end-to-end.
import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldHistory,assertHistoryTransition,type FoldedHistory,type HistoryEventKind,type Finding}from"../../../packages/adaptive-history/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC R — Historia clínica adaptativa: Chief Complaint -> HPI dinámico -> ROS -> Physical.
// EXEC-0009: Orden canónico: chief complaint -> HPI -> ROS -> Physical -> Assessment.
// EXEC-0010: Estados epistémicos explícitos (NOT_ASKED/NEGATIVE/POSITIVE/NOT_APPLICABLE/UNABLE_TO_ASSESS).
// EXEC-0011: Evidencia y confianza en hallazgos.
const AGG="AdaptiveHistory";

function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"history:write",purpose:"TREATMENT"});
}

const ChiefComplaintBody=z.object({historyId:z.string().uuid(),patientId:z.string().uuid(),encounterId:z.string().uuid(),chiefComplaint:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleChiefComplaint(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ChiefComplaintBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.historyId,expectedVersion:0,eventType:"CHIEF_COMPLAINT",payload:{kind:"CHIEF_COMPLAINT",patientId:b.patientId,encounterId:b.encounterId,chiefComplaint:b.chiefComplaint},occurredAt:b.occurredAt,topic:"history.chief_complaint"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({historyId:b.historyId,chiefComplaint:b.chiefComplaint,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,historyId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldHistory(await readAggregateEvents(ctx,historyId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","History not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,historyId:string,folded:FoldedHistory,to:HistoryEventKind,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:historyId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){
  // R2B-026: el ORIGEN es el último evento real de la historia, que ahora el fold expone. Antes era
  // `folded.chiefComplaint?to:"CHIEF_COMPLAINT"`, una condición siempre verdadera que hacía `assertHistoryTransition(to,to)`
  // y dejaba a `handleHpiComplete` y `handleRosComplete` incapaces de tener éxito en el 100 % de las llamadas reales.
  assertHistoryTransition(folded.lastEventKind??"CHIEF_COMPLAINT",to);
  result=await runClinicalCommand(ctx,cmd);
 }
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({historyId,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const FindingBody=z.object({findingId:z.string().uuid(),section:z.enum(["HPI","ROS","PHYSICAL"]),question:z.string().min(1),state:z.enum(["NOT_ASKED","NEGATIVE","POSITIVE","NOT_APPLICABLE","UNABLE_TO_ASSESS"]).default("NOT_ASKED"),answer:z.string().default(""),evidenceFor:z.array(z.string()).default([]),evidenceAgainst:z.array(z.string()).default([]),confidence:z.number().min(0).max(100).default(50),source:z.enum(["CLINICIAN_VERIFIED","PATIENT_REPORTED","IMPORTED","AI_EXTRACTED"]).default("CLINICIAN_VERIFIED"),occurredAt:z.string().datetime()});
export async function handleFindingRecord(req:Request,historyId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,historyId);
  const b=await parseJson(req,FindingBody);
  const kind=b.section==="HPI"?"HPI_FINDING":b.section==="ROS"?"ROS_FINDING":"PHYSICAL_FINDING";
  const payload={kind,findingId:b.findingId,section:b.section,question:b.question,state:b.state,answer:b.answer,evidenceFor:b.evidenceFor,evidenceAgainst:b.evidenceAgainst,confidence:b.confidence,source:b.source};
  return await commit(ctx,idempotencyKey,expectedVersion,historyId,folded,kind,`HISTORY_${b.section}_FINDING`,payload,b.occurredAt,`history.${b.section.toLowerCase()}_finding`);
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const CompleteBody=z.object({occurredAt:z.string().datetime()});
export async function handleHpiComplete(req:Request,historyId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,historyId);
  const b=await parseJson(req,CompleteBody);
  return await commit(ctx,idempotencyKey,expectedVersion,historyId,folded,"HPI_COMPLETED","HPI_COMPLETED",{kind:"HPI_COMPLETED"},b.occurredAt,"history.hpi_completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleRosComplete(req:Request,historyId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,historyId);
  const b=await parseJson(req,CompleteBody);
  return await commit(ctx,idempotencyKey,expectedVersion,historyId,folded,"ROS_COMPLETED","ROS_COMPLETED",{kind:"ROS_COMPLETED"},b.occurredAt,"history.ros_completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}