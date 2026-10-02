import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldIncident,assertIncidentTransition,type FoldedIncident,type IncidentState}from"../../../packages/incident-fold/src";
import{runClinicalCommand,lookupReplay,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC AG — Ciclo de vida de un incidente de seguridad: REPORTED -> UNDER_REVIEW -> {ESCALATED, RESOLVED}.
// Reporte de eventos adversos institucionales (farmacovigilancia); reportar/revisar/escalar/resolver exige scope incident:write.
const AGG="Incident";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"incident:write",purpose:"TREATMENT"});
}

export const ReportBody=z.object({incidentId:z.string().uuid(),patientId:z.string().uuid(),category:z.enum(["MEDICATION_ERROR","FALL","EQUIPMENT","ADVERSE_DRUG_REACTION","INFECTION","OTHER"]),severity:z.enum(["LOW","MODERATE","SEVERE"]),description:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleIncidentReport(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ReportBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.incidentId,expectedVersion:0,eventType:"INCIDENT_REPORTED",payload:{kind:"REPORTED",patientId:b.patientId,category:b.category,severity:b.severity,description:b.description},occurredAt:b.occurredAt,topic:"incident.reported"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({incidentId:b.incidentId,state:"REPORTED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedIncident,IncidentState>({aggregateType:AGG,idKey:"incidentId",notFound:"Incident not found",fold:foldIncident,assertTransition:assertIncidentTransition,authz});
const loadForTransition=(req:Request,incidentId:string)=>LIFECYCLE.loadForTransition(req,incidentId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,incidentId:string,folded:FoldedIncident,to:IncidentState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,incidentId,folded,to,eventType,payload,occurredAt,topic);

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleIncidentReview(req:Request,incidentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,incidentId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,incidentId,folded,"UNDER_REVIEW","INCIDENT_REVIEW_STARTED",{kind:"REVIEW_STARTED"},b.occurredAt,"incident.review_started");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleIncidentEscalation(req:Request,incidentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,incidentId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,incidentId,folded,"ESCALATED","INCIDENT_ESCALATED",{kind:"ESCALATED",reason:b.reason},b.occurredAt,"incident.escalated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ResolveBody=z.object({resolution:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleIncidentResolution(req:Request,incidentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,incidentId);const b=await parseJson(req,ResolveBody);
  return await commit(ctx,idempotencyKey,expectedVersion,incidentId,folded,"RESOLVED","INCIDENT_RESOLVED",{kind:"RESOLVED",resolution:b.resolution},b.occurredAt,"incident.resolved");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
