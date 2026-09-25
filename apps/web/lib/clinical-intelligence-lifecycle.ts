// ⚠️ NOT_WIRED (endurecimiento G / Epic BF): este handler NO está cableado a ninguna ruta (código inalcanzable).
// Ver docs/adjudication/not-wired-registry.json. R6 (IA) EN PAUSA: no activar. No cuenta como capacidad end-to-end.
import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{ClinicalIntelligenceEngine,DEFAULT_KNOWLEDGE_PACKAGES,compileCondition}from"../../../packages/clinical-intelligence/src";
import type {DeclarativeCondition,KnowledgePackage}from"../../../packages/clinical-intelligence/src";
import type {PatientStateSummary,IntelligenceOutput}from"../../../packages/clinical-intelligence/src";
// EPIC S — Clinical Intelligence Deterministic Layer (EXEC-0021, EXEC-0022, EXEC-0025).
// Deterministic engine: Patient State, Clinical Reasoning, Omission Detection, Safety, Care Gaps.
// Separable from probabilistic AI. AI Risk Tiers enforced (Tier D blocked).
// Authority: PROD (CDS determinístico), CAP-CLINICAL-INTEL-001.

const AGG="ClinicalIntelligence";

function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string},requirePhysician=false){
 const opts:{role?:string;scope:string;purpose?:string}={scope:"intelligence:write",purpose:"TREATMENT"};
 if(requirePhysician)opts.role="PHYSICIAN";
 authorize(principalFrom(claims),opts);
}

// Singleton engine with default packages
const engine=new ClinicalIntelligenceEngine(DEFAULT_KNOWLEDGE_PACKAGES);

const EvaluateBody=z.object({
  patientId:z.string().uuid(),
  chiefComplaint:z.string().optional(),
  age:z.number().int().positive().max(120),
  sex:z.enum(["M","F","O"]),
  activeProblems:z.array(z.object({code:z.string(),status:z.string(),onset:z.string()})).default([]),
  activeMedications:z.array(z.object({code:z.string(),dose:z.string(),route:z.string(),frequency:z.string()})).default([]),
  allergies:z.array(z.object({substance:z.string(),reaction:z.string(),severity:z.string()})).default([]),
  recentVitals:z.array(z.object({type:z.string(),value:z.number(),unit:z.string(),timestamp:z.string()})).default([]),
  recentResults:z.array(z.object({code:z.string(),value:z.number(),unit:z.string(),status:z.string(),timestamp:z.string()})).default([]),
  openObligations:z.array(z.object({type:z.string(),dueAt:z.string(),priority:z.string()})).default([]),
  occurredAt:z.string().datetime(),
});

export async function handleIntelligenceEvaluate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,EvaluateBody);

  const state:PatientStateSummary={
   patientId:b.patientId,
   age:b.age,
   sex:b.sex,
   activeProblems:b.activeProblems,
   activeMedications:b.activeMedications,
   allergies:b.allergies,
   recentVitals:b.recentVitals,
   recentResults:b.recentResults,
   openObligations:b.openObligations,
  };

  const output:IntelligenceOutput=engine.evaluate(state,b.chiefComplaint);

  // AUDITORÍA 2026-09-17: el aggregateId era `intel-<uuid>-<Date.now()>` — NO es un uuid válido y
  // clinical_events.aggregate_id es uuid NOT NULL -> cada evaluación reventaría con 22P02 (500).
  // Cada evaluación es una entrada de log append-only nueva: se usa un uuid válido.
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:crypto.randomUUID(),expectedVersion:0,eventType:"INTELLIGENCE_EVALUATED",payload:{kind:"EVALUATED",patientId:b.patientId,output},occurredAt:b.occurredAt,topic:"intelligence.evaluated"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};

  return NextResponse.json({patientId:b.patientId,output,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// Auditoría 2026-09-19, anexo R02b (R2B-007 — lote 17) — LAS CONDICIONES DEJAN DE SER TEXTO.
//
// Este cuerpo declaraba `condition`/`trigger` como `z.string()`. El hallazgo original era ejecución remota de código: esas
// cadenas acababan en `new Function(...)` dentro del motor. El `new Function` se retiró (L-13), pero el `z.string()` se quedó,
// y eso dejó un defecto distinto y silencioso: la ruta aceptaba el paquete, respondía `registered:true`, y al evaluar
// `condition(ctx)` sobre una cadena el `TypeError` lo absorbía el `try/catch` del motor. Un paquete registrado con éxito y con
// todas sus reglas MUERTAS. Ahora la condición es una estructura declarativa que el motor interpreta sin ejecutar código, y un
// paquete que no se pueda interpretar se RECHAZA al registrarlo.
//
// El esquema es recursivo (`all`/`any`/`not`), así que se declara con `z.lazy`.
const CONDITION:z.ZodType<DeclarativeCondition>=z.lazy(()=>z.object({
  field:z.enum(["age","sex","chiefComplaint","hasProblem","hasMedication","hasAllergy","vital","result"]).optional(),
  op:z.enum(["eq","ne","lt","lte","gt","gte","contains","startsWith","present"]).optional(),
  value:z.union([z.string().max(200),z.number()]).optional(),
  key:z.string().max(60).optional(),
  all:z.array(CONDITION).max(10).optional(),
  any:z.array(CONDITION).max(10).optional(),
  not:CONDITION.optional(),
}).strict().refine(c=>c.all!==undefined||c.any!==undefined||c.not!==undefined||(c.field!==undefined&&c.op!==undefined),
  "Una condición es un combinador (all/any/not) o un par field+op") as unknown as z.ZodType<DeclarativeCondition>);
const RegisterPackageBody=z.object({
  id:z.string().min(1),version:z.string().min(1),specialty:z.string(),
  effectiveDate:z.string(),reviewers:z.array(z.object({id:z.string(),role:z.string()})).min(1),
  sources:z.array(z.object({citation:z.string(),url:z.string().optional()})).default([]),
  applicability:z.array(z.object({condition:CONDITION,include:z.boolean()})).default([]),
  questions:z.array(z.object({id:z.string(),text:z.string(),trigger:CONDITION,expectedAnswers:z.array(z.string()),required:z.boolean()})).default([]),
  redFlags:z.array(z.object({id:z.string(),condition:CONDITION,action:z.string(),severity:z.enum(["INFO","CONSIDER","IMPORTANT","CRITICAL"]),evidence:z.array(z.string()),version:z.string()})).default([]),
  focusedExam:z.array(z.object({id:z.string(),condition:CONDITION,action:z.string(),severity:z.enum(["INFO","CONSIDER","IMPORTANT","CRITICAL"]).default("CONSIDER"),evidence:z.array(z.string()),version:z.string().default("1")})).default([]),
  differentialHints:z.array(z.object({id:z.string(),condition:CONDITION,action:z.string(),severity:z.enum(["INFO","CONSIDER","IMPORTANT","CRITICAL"]).default("CONSIDER"),evidence:z.array(z.string()),version:z.string().default("1")})).default([]),
  orderConsiderations:z.array(z.object({id:z.string(),condition:CONDITION,action:z.string(),evidence:z.array(z.string()),version:z.string()})).default([]),
  followUpRules:z.array(z.object({id:z.string(),condition:CONDITION,action:z.string(),evidence:z.array(z.string()),version:z.string()})).default([]),
  safetyNet:z.array(z.object({id:z.string(),condition:CONDITION,action:z.string(),severity:z.enum(["INFO","CONSIDER","IMPORTANT","CRITICAL"]).default("IMPORTANT"),evidence:z.array(z.string()),version:z.string().default("1")})).default([]),
});

export async function handleKnowledgePackageRegister(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims,true);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,RegisterPackageBody);

  // Las condiciones declarativas se COMPILAN a las funciones tipadas que el motor evalúa. Si alguna no es interpretable,
  // `compileCondition` lanza y el paquete se rechaza aquí: es la diferencia entre «registrado con reglas muertas» y «no
  // registrado, y se dice por qué».
  const pkg:KnowledgePackage={id:b.id,version:b.version,specialty:b.specialty,effectiveDate:b.effectiveDate,
   reviewers:b.reviewers,
   // `exactOptionalPropertyTypes`: zod produce `url?:string|undefined` y el tipo del paquete pide `url?:string`. Se omite la
   // clave cuando no viene, en vez de ensanchar el tipo del paquete para que acepte `undefined`.
   sources:b.sources.map(x=>x.url===undefined?{citation:x.citation}:{citation:x.citation,url:x.url}),
   applicability:b.applicability.map(r=>({condition:compileCondition(r.condition),include:r.include})),
   questions:b.questions.map(q=>({id:q.id,text:q.text,trigger:compileCondition(q.trigger),expectedAnswers:q.expectedAnswers,required:q.required})),
   redFlags:b.redFlags.map(r=>({id:r.id,condition:compileCondition(r.condition),action:r.action,severity:r.severity,evidence:r.evidence,version:r.version})),
   focusedExam:b.focusedExam.map(r=>({id:r.id,condition:compileCondition(r.condition),action:r.action,severity:r.severity,evidence:r.evidence,version:r.version})),
   differentialHints:b.differentialHints.map(r=>({id:r.id,condition:compileCondition(r.condition),action:r.action,severity:r.severity,evidence:r.evidence,version:r.version})),
   orderConsiderations:b.orderConsiderations.map(r=>({id:r.id,condition:compileCondition(r.condition),action:r.action,evidence:r.evidence,version:r.version})),
   followUpRules:b.followUpRules.map(r=>({id:r.id,condition:compileCondition(r.condition),action:r.action,evidence:r.evidence,version:r.version})),
   safetyNet:b.safetyNet.map(r=>({id:r.id,condition:compileCondition(r.condition),action:r.action,severity:r.severity,evidence:r.evidence,version:r.version}))};
  // AUDITORÍA 2026-09-17: antes usaba require() en un módulo ESM y registraba sobre un motor DESECHABLE
  // (new Engine([])) -> el paquete se descartaba y la respuesta 'registered:true' mentía. Se registra en el
  // singleton `engine`. NOTA: es registro EN MEMORIA por instancia (no durable/compartido en serverless);
  // la persistencia event-sourced del catálogo de conocimiento queda pendiente antes de activar esta ruta.
  engine.registerPackage(pkg);

  return NextResponse.json({packageId:b.id,version:b.version,registered:true,persistence:"in-memory"},{status:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const AIRiskBody=z.object({tier:z.enum(["A","B","C","D"]),operation:z.string().min(1)});
export async function handleAIRiskCheck(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,AIRiskBody);
  if(b.tier==="D")throw new ClinicalError("SAFETY_BLOCKED","AI Tier D (autonomous) not permitted");
  return NextResponse.json({tier:b.tier,operation:b.operation,allowed:true},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}