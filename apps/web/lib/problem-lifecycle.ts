import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldProblem,assertProblemTransition,assertProblemAnnotation,type FoldedProblem,type ProblemState,type ProblemAnnotationKind}from"../../../packages/problem-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{normalizeIcd10,lookupIcd10}from"../../../packages/terminology/src";
// EPIC Q — Lista de problemas: ADDED(ACTIVE) -> RESOLVED / CHRONIC / ENTERED_IN_ERROR; RESOLVED -> ACTIVE.
// EPIC AM (profundidad): el código del problema se valida contra CIE-10 y se codifica con su descripción canónica.
// EXEC-0011: Problemas con estado epistémico explícito (possible/probable/confirmed/refuted/historical/resolved)
// y evidencia (evidence_for/against, confidence, source).
const AGG="ClinicalProblem";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"problem:write",purpose:"TREATMENT"});
}
// Auditoría U-04: el formulario capturaba tipo, gravedad, fecha de inicio y notas y los descartaba en silencio. Ahora viajan
// y se persisten en el evento ADDED. El estado clínico inicial lo fija la máquina de estados (ADDED => ACTIVE); "crónico" y
// "resuelto" se registran con sus transiciones propias desde la UI.
export const CreateBody=z.object({problemId:z.string().uuid(),patientId:z.string().uuid(),code:z.string().min(1),description:z.string().optional(),
 problemType:z.enum(["ACUTE","CHRONIC","RECURRENT"]).optional(),severity:z.enum(["MILD","MODERATE","SEVERE"]).optional(),
 onsetDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,"onsetDate must be YYYY-MM-DD").optional(),notes:z.string().max(2000).optional(),epistemic:z.enum(["POSSIBLE","PROBABLE","CONFIRMED","REFUTED","HISTORICAL","RESOLVED"]).default("POSSIBLE"),evidenceFor:z.array(z.string()).default([]),evidenceAgainst:z.array(z.string()).default([]),confidence:z.number().min(0).max(100).default(50),source:z.enum(["CLINICIAN_VERIFIED","PATIENT_REPORTED","IMPORTED","AI_EXTRACTED"]).default("CLINICIAN_VERIFIED"),occurredAt:z.string().datetime()});
export async function handleProblemCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  // Profundidad clínica: el código debe existir en CIE-10; se codifica con su descripción canónica.
  const entry=lookupIcd10(b.code);
  if(!entry)throw new ClinicalError("VALIDATION_ERROR","Código CIE-10 no válido o no reconocido",{code:b.code});
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.problemId,expectedVersion:0,eventType:"PROBLEM_ADDED",payload:{kind:"ADDED",patientId:b.patientId,code:normalizeIcd10(b.code),description:entry.description,codeSystem:"CIE-10 OMS",category:entry.category,epistemic:b.epistemic,evidenceFor:b.evidenceFor,evidenceAgainst:b.evidenceAgainst,confidence:b.confidence,source:b.source,
  ...(b.problemType?{problemType:b.problemType}:{}),...(b.severity?{severity:b.severity}:{}),...(b.onsetDate?{onsetDate:b.onsetDate}:{}),...(b.notes?{notes:b.notes}:{}),...(b.description?{clinicianDescription:b.description}:{})},occurredAt:b.occurredAt,topic:"problem.added"});
  const result=await runClinicalCommand(ctx,cmd);const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({problemId:b.problemId,state:"ACTIVE",code:normalizeIcd10(b.code),description:entry.description,codeSystem:"ICD-10",epistemic:b.epistemic,evidenceFor:b.evidenceFor,evidenceAgainst:b.evidenceAgainst,confidence:b.confidence,source:b.source,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
async function loadForTransition(req:Request,problemId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldProblem(await readAggregateEvents(ctx,problemId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Problem not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,problemId:string,folded:FoldedProblem,to:ProblemState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:problemId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertProblemTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({problemId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}
// Auditoría L-04 — ANOTACIÓN (estado epistémico / evidencia): no cambia el estado del problema. Antes se pedía la
// "transición" X->X, que ningún fold admite, y estas dos rutas respondían 409 siempre.
async function commitAnnotation(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,problemId:string,folded:FoldedProblem,kind:ProblemAnnotationKind,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:problemId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){
  if(expectedVersion!==folded.version)throw new ClinicalError("CONCURRENCY_CONFLICT","Problem changed since last read",{expected:expectedVersion,actual:folded.version});
  assertProblemAnnotation(folded.state,kind);result=await runClinicalCommand(ctx,cmd);
 }
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({problemId,state:folded.state,annotation:kind,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export const ResolveBody=z.object({note:z.string().min(1),occurredAt:z.string().datetime()});
export const EpistemicBody=z.object({epistemic:z.enum(["POSSIBLE","PROBABLE","CONFIRMED","REFUTED","HISTORICAL","RESOLVED"]),occurredAt:z.string().datetime()});
export const EvidenceBody=z.object({evidenceFor:z.array(z.string()).optional(),evidenceAgainst:z.array(z.string()).optional(),confidence:z.number().min(0).max(100).optional(),occurredAt:z.string().datetime()});

export async function handleProblemEpistemicUpdate(req:Request,problemId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,problemId);const b=await parseJson(req,EpistemicBody);
  return await commitAnnotation(ctx,idempotencyKey,expectedVersion,problemId,folded,"EPISTEMIC_CHANGED","PROBLEM_EPISTEMIC_CHANGED",{kind:"EPISTEMIC_CHANGED",epistemic:b.epistemic},b.occurredAt,"problem.epistemic_changed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

export async function handleProblemEvidenceUpdate(req:Request,problemId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,problemId);const b=await parseJson(req,EvidenceBody);
  if(b.evidenceFor===undefined&&b.evidenceAgainst===undefined&&b.confidence===undefined)throw new ClinicalError("VALIDATION_ERROR","Indique evidenceFor, evidenceAgainst o confidence");
  const payload:Record<string,unknown>={kind:"EVIDENCE_UPDATED"};
  if(b.evidenceFor!==undefined)payload["evidenceFor"]=b.evidenceFor;if(b.evidenceAgainst!==undefined)payload["evidenceAgainst"]=b.evidenceAgainst;if(b.confidence!==undefined)payload["confidence"]=b.confidence;
  return await commitAnnotation(ctx,idempotencyKey,expectedVersion,problemId,folded,"EVIDENCE_UPDATED","PROBLEM_EVIDENCE_UPDATED",payload,b.occurredAt,"problem.evidence_updated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleProblemResolution(req:Request,problemId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,problemId);const b=await parseJson(req,ResolveBody);
  return await commit(ctx,idempotencyKey,expectedVersion,problemId,folded,"RESOLVED","PROBLEM_RESOLVED",{kind:"RESOLVED",note:b.note},b.occurredAt,"problem.resolved");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleProblemReactivation(req:Request,problemId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,problemId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,problemId,folded,"ACTIVE","PROBLEM_REACTIVATED",{kind:"REACTIVATED"},b.occurredAt,"problem.reactivated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleProblemChronicity(req:Request,problemId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,problemId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,problemId,folded,"CHRONIC","PROBLEM_MARKED_CHRONIC",{kind:"MARKED_CHRONIC"},b.occurredAt,"problem.chronic");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
