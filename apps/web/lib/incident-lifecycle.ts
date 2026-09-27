import{z}from"zod";
import{foldIncident,assertIncidentTransition}from"../../../packages/incident-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC AG — Ciclo de vida de un incidente de seguridad: REPORTED -> UNDER_REVIEW -> {ESCALATED, RESOLVED}.
// Reporte de eventos adversos institucionales (farmacovigilancia); reportar/revisar/escalar/resolver exige scope incident:write.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const INCIDENT={aggregateType:"Incident",idField:"incidentId",fold:foldIncident,assertTransition:assertIncidentTransition,notFound:"Incident not found"} as const;
const WRITE={scope:"incident:write",purpose:"TREATMENT"} as const;

export const ReportBody=z.object({incidentId:z.string().uuid(),patientId:z.string().uuid(),category:z.enum(["MEDICATION_ERROR","FALL","EQUIPMENT","ADVERSE_DRUG_REACTION","INFECTION","OTHER"]),severity:z.enum(["LOW","MODERATE","SEVERE"]),description:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleIncidentReport(req:Request):Promise<Response>{
 return createCommand(req,WRITE,INCIDENT,async({ctx})=>{
  const b=await parseJson(req,ReportBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.incidentId,state:"REPORTED",eventType:"INCIDENT_REPORTED",payload:{kind:"REPORTED",patientId:b.patientId,category:b.category,severity:b.severity,description:b.description},occurredAt:b.occurredAt,topic:"incident.reported"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleIncidentReview(req:Request,incidentId:string):Promise<Response>{
 return transitionCommand(req,WRITE,INCIDENT,incidentId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"UNDER_REVIEW",eventType:"INCIDENT_REVIEW_STARTED",payload:{kind:"REVIEW_STARTED"},occurredAt:b.occurredAt,topic:"incident.review_started"};});
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleIncidentEscalation(req:Request,incidentId:string):Promise<Response>{
 return transitionCommand(req,WRITE,INCIDENT,incidentId,async()=>{const b=await parseJson(req,ReasonBody);
  return{to:"ESCALATED",eventType:"INCIDENT_ESCALATED",payload:{kind:"ESCALATED",reason:b.reason},occurredAt:b.occurredAt,topic:"incident.escalated"};});
}
export const ResolveBody=z.object({resolution:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleIncidentResolution(req:Request,incidentId:string):Promise<Response>{
 return transitionCommand(req,WRITE,INCIDENT,incidentId,async()=>{const b=await parseJson(req,ResolveBody);
  return{to:"RESOLVED",eventType:"INCIDENT_RESOLVED",payload:{kind:"RESOLVED",resolution:b.resolution},occurredAt:b.occurredAt,topic:"incident.resolved"};});
}
