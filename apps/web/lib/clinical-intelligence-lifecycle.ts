import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{ClinicalIntelligenceEngine,DEFAULT_KNOWLEDGE_PACKAGES}from"../../../packages/clinical-intelligence/src";
import type {PatientStateSummary,IntelligenceOutput}from"../../../packages/clinical-intelligence/src";
// EPIC S — Clinical Intelligence Deterministic Layer (EXEC-0021, EXEC-0022, EXEC-0025).
// Deterministic engine: Patient State, Clinical Reasoning, Omission Detection, Safety, Care Gaps.
// Separable from probabilistic AI. AI Risk Tiers enforced (Tier D blocked).
// Authority: PROD (CDS determinístico), CAP-CLINICAL-INTEL-001.

const AGG="ClinicalIntelligence";

function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string},requirePhysician=false){
 const opts:{tenantId:string;role?:string;scope?:string;purpose?:string}={tenantId:claims.tenantId,scope:"intelligence:write",purpose:"TREATMENT"};
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

  const idempotencyKey2=req.headers.get("idempotency-key")??crypto.randomUUID();
  const cmd=buildCommand({idempotencyKey:idempotencyKey2,aggregateType:AGG,aggregateId:`intel-${b.patientId}-${Date.now()}`,expectedVersion:0,eventType:"INTELLIGENCE_EVALUATED",payload:{kind:"EVALUATED",patientId:b.patientId,output},occurredAt:b.occurredAt,topic:"intelligence.evaluated"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};

  return NextResponse.json({patientId:b.patientId,output,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const RegisterPackageBody=z.object({
  id:z.string().min(1),version:z.string().min(1),specialty:z.string(),
  effectiveDate:z.string(),reviewers:z.array(z.object({id:z.string(),role:z.string()})).min(1),
  sources:z.array(z.object({citation:z.string(),url:z.string().optional()})).default([]),
  applicability:z.array(z.object({condition:z.string(),include:z.boolean()})).default([]),
  questions:z.array(z.object({id:z.string(),text:z.string(),trigger:z.string(),expectedAnswers:z.array(z.string()),required:z.boolean()})).default([]),
  redFlags:z.array(z.object({id:z.string(),condition:z.string(),action:z.string(),severity:z.enum(["INFO","CONSIDER","IMPORTANT","CRITICAL"]),evidence:z.array(z.string()),version:z.string()})).default([]),
  focusedExam:z.array(z.object({id:z.string(),condition:z.string(),action:z.string(),evidence:z.array(z.string())})).default([]),
  differentialHints:z.array(z.object({id:z.string(),condition:z.string(),action:z.string(),evidence:z.array(z.string())})).default([]),
  orderConsiderations:z.array(z.object({id:z.string(),condition:z.string(),action:z.string(),evidence:z.array(z.string()),version:z.string()})).default([]),
  followUpRules:z.array(z.object({id:z.string(),condition:z.string(),action:z.string(),evidence:z.array(z.string()),version:z.string()})).default([]),
  safetyNet:z.array(z.object({id:z.string(),condition:z.string(),action:z.string(),evidence:z.array(z.string())})).default([]),
});

export async function handleKnowledgePackageRegister(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims,true);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,RegisterPackageBody);

  const pkg={id:b.id,version:b.version,specialty:b.specialty,effectiveDate:b.effectiveDate,reviewers:b.reviewers,sources:b.sources,applicability:b.applicability,questions:b.questions,redFlags:b.redFlags,focusedExam:b.focusedExam,differentialHints:b.differentialHints,orderConsiderations:b.orderConsiderations,followUpRules:b.followUpRules,safetyNet:b.safetyNet};
  new (require("../../../packages/clinical-intelligence/src").ClinicalIntelligenceEngine)([]).registerPackage(pkg);

  return NextResponse.json({packageId:b.id,version:b.version,registered:true},{status:201});
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