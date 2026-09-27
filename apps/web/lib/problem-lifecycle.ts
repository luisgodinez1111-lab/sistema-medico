import{z}from"zod";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldProblem,assertProblemTransition,assertProblemAnnotation}from"../../../packages/problem-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
import{normalizeIcd10,lookupIcd10}from"../../../packages/terminology/src";
// EPIC Q — Lista de problemas: ADDED(ACTIVE) -> RESOLVED / CHRONIC / ENTERED_IN_ERROR; RESOLVED -> ACTIVE.
// EPIC AM (profundidad): el código del problema se valida contra CIE-10 y se codifica con su descripción canónica.
// EXEC-0011: Problemas con estado epistémico explícito (possible/probable/confirmed/refuted/historical/resolved)
// y evidencia (evidence_for/against, confidence, source).
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const PROBLEM={aggregateType:"ClinicalProblem",idField:"problemId",fold:foldProblem,assertTransition:assertProblemTransition,notFound:"Problem not found",changed:"Problem changed since last read"} as const;
const WRITE={scope:"problem:write",purpose:"TREATMENT"} as const;
// Auditoría U-04: el formulario capturaba tipo, gravedad, fecha de inicio y notas y los descartaba en silencio. Ahora viajan
// y se persisten en el evento ADDED. El estado clínico inicial lo fija la máquina de estados (ADDED => ACTIVE); "crónico" y
// "resuelto" se registran con sus transiciones propias desde la UI.
export const CreateBody=z.object({problemId:z.string().uuid(),patientId:z.string().uuid(),code:z.string().min(1),description:z.string().optional(),
 problemType:z.enum(["ACUTE","CHRONIC","RECURRENT"]).optional(),severity:z.enum(["MILD","MODERATE","SEVERE"]).optional(),
 onsetDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,"onsetDate must be YYYY-MM-DD").optional(),notes:z.string().max(2000).optional(),epistemic:z.enum(["POSSIBLE","PROBABLE","CONFIRMED","REFUTED","HISTORICAL","RESOLVED"]).default("POSSIBLE"),evidenceFor:z.array(z.string()).default([]),evidenceAgainst:z.array(z.string()).default([]),confidence:z.number().min(0).max(100).default(50),source:z.enum(["CLINICIAN_VERIFIED","PATIENT_REPORTED","IMPORTED","AI_EXTRACTED"]).default("CLINICIAN_VERIFIED"),occurredAt:z.string().datetime()});
export async function handleProblemCreate(req:Request):Promise<Response>{
 return createCommand(req,WRITE,PROBLEM,async({ctx})=>{
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  // Profundidad clínica: el código debe existir en CIE-10; se codifica con su descripción canónica.
  const entry=lookupIcd10(b.code);
  if(!entry)throw new ClinicalError("VALIDATION_ERROR","Código CIE-10 no válido o no reconocido",{code:b.code});
  return{aggregateId:b.problemId,state:"ACTIVE",eventType:"PROBLEM_ADDED",payload:{kind:"ADDED",patientId:b.patientId,code:normalizeIcd10(b.code),description:entry.description,codeSystem:"CIE-10 OMS",category:entry.category,epistemic:b.epistemic,evidenceFor:b.evidenceFor,evidenceAgainst:b.evidenceAgainst,confidence:b.confidence,source:b.source,
  ...(b.problemType?{problemType:b.problemType}:{}),...(b.severity?{severity:b.severity}:{}),...(b.onsetDate?{onsetDate:b.onsetDate}:{}),...(b.notes?{notes:b.notes}:{}),...(b.description?{clinicianDescription:b.description}:{})},occurredAt:b.occurredAt,topic:"problem.added",
   extra:{code:normalizeIcd10(b.code),description:entry.description,codeSystem:"ICD-10",epistemic:b.epistemic,evidenceFor:b.evidenceFor,evidenceAgainst:b.evidenceAgainst,confidence:b.confidence,source:b.source}};
 });
}
export const WhenBody=z.object({occurredAt:z.string().datetime()});
export const ResolveBody=z.object({note:z.string().min(1),occurredAt:z.string().datetime()});
export const EpistemicBody=z.object({epistemic:z.enum(["POSSIBLE","PROBABLE","CONFIRMED","REFUTED","HISTORICAL","RESOLVED"]),occurredAt:z.string().datetime()});
export const EvidenceBody=z.object({evidenceFor:z.array(z.string()).optional(),evidenceAgainst:z.array(z.string()).optional(),confidence:z.number().min(0).max(100).optional(),occurredAt:z.string().datetime()});
// Auditoría L-04 — ANOTACIÓN (estado epistémico / evidencia): no cambia el estado del problema. Antes se pedía la
// "transición" X->X, que ningún fold admite, y estas dos rutas respondían 409 siempre. En el pipeline: versión estricta
// (`strictVersion`), `assertProblemAnnotation` en lugar de la máquina de estados (`check`) y el estado plegado en la respuesta.
export async function handleProblemEpistemicUpdate(req:Request,problemId:string):Promise<Response>{
 return transitionCommand(req,WRITE,PROBLEM,problemId,async({folded})=>{const b=await parseJson(req,EpistemicBody);
  return{to:folded.state,strictVersion:true,check:()=>assertProblemAnnotation(folded.state,"EPISTEMIC_CHANGED"),eventType:"PROBLEM_EPISTEMIC_CHANGED",payload:{kind:"EPISTEMIC_CHANGED",epistemic:b.epistemic},occurredAt:b.occurredAt,topic:"problem.epistemic_changed",extra:{annotation:"EPISTEMIC_CHANGED"}};});
}

export async function handleProblemEvidenceUpdate(req:Request,problemId:string):Promise<Response>{
 return transitionCommand(req,WRITE,PROBLEM,problemId,async({folded})=>{const b=await parseJson(req,EvidenceBody);
  if(b.evidenceFor===undefined&&b.evidenceAgainst===undefined&&b.confidence===undefined)throw new ClinicalError("VALIDATION_ERROR","Indique evidenceFor, evidenceAgainst o confidence");
  const payload:Record<string,unknown>={kind:"EVIDENCE_UPDATED"};
  if(b.evidenceFor!==undefined)payload["evidenceFor"]=b.evidenceFor;if(b.evidenceAgainst!==undefined)payload["evidenceAgainst"]=b.evidenceAgainst;if(b.confidence!==undefined)payload["confidence"]=b.confidence;
  return{to:folded.state,strictVersion:true,check:()=>assertProblemAnnotation(folded.state,"EVIDENCE_UPDATED"),eventType:"PROBLEM_EVIDENCE_UPDATED",payload,occurredAt:b.occurredAt,topic:"problem.evidence_updated",extra:{annotation:"EVIDENCE_UPDATED"}};});
}
export async function handleProblemResolution(req:Request,problemId:string):Promise<Response>{
 return transitionCommand(req,WRITE,PROBLEM,problemId,async()=>{const b=await parseJson(req,ResolveBody);
  return{to:"RESOLVED",eventType:"PROBLEM_RESOLVED",payload:{kind:"RESOLVED",note:b.note},occurredAt:b.occurredAt,topic:"problem.resolved"};});
}
export async function handleProblemReactivation(req:Request,problemId:string):Promise<Response>{
 return transitionCommand(req,WRITE,PROBLEM,problemId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"ACTIVE",eventType:"PROBLEM_REACTIVATED",payload:{kind:"REACTIVATED"},occurredAt:b.occurredAt,topic:"problem.reactivated"};});
}
export async function handleProblemChronicity(req:Request,problemId:string):Promise<Response>{
 return transitionCommand(req,WRITE,PROBLEM,problemId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"CHRONIC",eventType:"PROBLEM_MARKED_CHRONIC",payload:{kind:"MARKED_CHRONIC"},occurredAt:b.occurredAt,topic:"problem.chronic"};});
}
