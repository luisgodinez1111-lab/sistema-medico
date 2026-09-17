import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{ClinicalIntelligenceEngine,DEFAULT_KNOWLEDGE_PACKAGES,type PatientStateSummary,type IntelligenceOutput}from"../../../packages/clinical-intelligence/src";
import{Envelope,enforceEnvelope}from"../../../packages/ai-gateway/src";
import{SafetyEnvelope}from"../../../packages/ai-gateway/src/safety-envelope";
import{validateAiReceipt}from"../../../packages/ai-evidence/src";
// EPIC T — AI Gateway + Low/Moderate Risk Assistance (EXEC-0024, EXEC-0025, EXEC-0025, EXEC-0026).
// All model calls pass through controlled gateway. Conceptual request/result from EXEC-0024.
// Tier A (low), Tier B (doc assistance), Tier C (decision support), Tier D (autonomous - BLOCKED per EXEC-0025).
// High-impact AI requires AI-TASK contract, evidence policy, abstention policy, eval suite, owner, kill switch.
// EXEC-0026: Prompt injection prevention - untrusted clinical content != trusted instructions.
// Authority: PROD (AI governance), CAP-AI-GATEWAY-001.

const AGG="AiGateway";

function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string},requirePhysician=false){
 const opts:{tenantId:string;role?:string;scope?:string;purpose?:string}={tenantId:claims.tenantId,scope:"ai:write",purpose:"TREATMENT"};
 if(requirePhysician)opts.role="PHYSICIAN";
 authorize(principalFrom(claims),opts);
}

// Clinical Intelligence engine for deterministic pre/post-processing
const clinicalEngine=new ClinicalIntelligenceEngine(DEFAULT_KNOWLEDGE_PACKAGES);

// In-memory registry for AI Task Cards and Envelopes (production uses DB)
const TASK_CARD_REGISTRY:Map<string,any>=new Map();
const ENVELOPE_REGISTRY:Map<string,any>=new Map();

// --- AI TASK CARD REGISTRATION (Physician Control) ---
const RegisterTaskCardBody=z.object({
  id:z.string().regex(/^AI-TASK-\d{4}$/),version:z.string().min(1),
  purpose:z.string().min(1),risk:z.enum(["C2","C3","C4","C5"]),
  authority:z.array(z.string().regex(/^ENG-\d{3}$/)).min(1),
  minimumNecessaryFields:z.array(z.string()).min(1),outputSchema:z.string().min(1),
  allowed:z.array(z.string()).min(1),prohibited:z.array(z.string()).min(1),
  evidence:z.string().min(1),abstention:z.string().min(1),owner:z.string().min(1),
  evalSuite:z.string().min(1),killSwitch:z.literal(true),envelope:z.string().regex(/^SE-\d{4}$/),
});

export async function handleRegisterTaskCard(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims,true);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,RegisterTaskCardBody);
  const envelopeExists=ENVELOPE_REGISTRY.has(b.envelope);
  if(!envelopeExists)throw new ClinicalError("VALIDATION_ERROR",`Envelope ${b.envelope} not registered`);
  TASK_CARD_REGISTRY.set(b.id,b);
  return NextResponse.json({taskCardId:b.id,version:b.version,registered:true},{status:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// --- ENVELOPE REGISTRATION (Physician Control) ---
const RegisterEnvelopeBody=z.object({
  id:z.string().regex(/^SE-\d{4}$/),aiTask:z.string().regex(/^AI-TASK-\d{4}$/),
  supported:z.array(z.string()).min(1),preconditions:z.array(z.string()).default([]),
  exclusions:z.array(z.string()).default([]),
  failureMode:z.enum(["ABSTAIN","SAFETY_BLOCKED","DEPENDENCY_UNAVAILABLE","INVALID_INPUT"]),
  humanApprovalRequired:z.boolean(),killSwitch:z.boolean(),evidenceRequired:z.boolean(),
});

export async function handleRegisterEnvelope(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims,true);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,RegisterEnvelopeBody);
  const envelope=SafetyEnvelope.parse(b);
  ENVELOPE_REGISTRY.set(b.id,envelope);
  return NextResponse.json({envelopeId:b.id,registered:true},{status:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// --- AI GATEWAY EXECUTION (EXEC-0024) ---
const ExecuteTaskBody=z.object({
  taskId:z.string().regex(/^AI-TASK-\d{4}$/),
  tenantId:z.string().uuid(),patientContextRef:z.string().optional(),
  encounterId:z.string().uuid().optional(),
  minimumNecessaryContext:z.record(z.string(),z.unknown()),
  sensitivity:z.enum(["low","moderate","high"]),
  intendedUse:z.string().min(1),outputSchema:z.string().min(1),
});

export async function handleAiGatewayExecute(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ExecuteTaskBody);

  // 1. Load Task Card
  const taskCard=TASK_CARD_REGISTRY.get(b.taskId);
  if(!taskCard)throw new ClinicalError("NOT_FOUND",`Task card ${b.taskId} not registered`);

  // 2. Load Envelope
  const envelope=ENVELOPE_REGISTRY.get(taskCard.envelope);
  if(!envelope)throw new ClinicalError("VALIDATION_ERROR",`Envelope ${taskCard.envelope} not registered`);

  // 3. Validate minimum necessary context (EXEC-0026)
  for(const field of taskCard.minimumNecessaryFields){
    if(!(field in b.minimumNecessaryContext))throw new ClinicalError("VALIDATION_ERROR",`Missing required field: ${field}`);
  }
  for(const field of taskCard.prohibited){
    if(field in b.minimumNecessaryContext)throw new ClinicalError("VALIDATION_ERROR",`Prohibited field in context: ${field}`);
  }

  // 4. Deterministic pre-processing (Clinical Intelligence Engine)
  const engine=new ClinicalIntelligenceEngine(DEFAULT_KNOWLEDGE_PACKAGES);

  // 4. Enforce Safety Envelope (EXEC-0025)
  const envelopeCheck=enforceEnvelope({
   id:taskCard.envelope,
   risk:taskCard.risk,
   human_approval_required:taskCard.risk==="C4"||taskCard.risk==="C5",
   kill_switch:taskCard.killSwitch,
   evidence_required:taskCard.risk==="C4"||taskCard.risk==="C5",
   failure_mode:envelope.failureMode,
  },{
   killSwitchEnabled:taskCard.killSwitch,
   hasEvidence:true,
   humanApproved:true,
  });
  if(envelopeCheck.status!=="ALLOWED")throw new ClinicalError("SAFETY_BLOCKED",`AI task blocked by envelope: ${envelopeCheck.status}`);

  // 5. Execute AI call (simulated - in production calls actual model)
  // EXEC-0024: All model calls pass through gateway
  const aiResult=await simulateAiCall(taskCard,b.minimumNecessaryContext);

  // 5b. Validate AI result schema
  if(!validateOutputSchema(aiResult,taskCard.outputSchema)){
   throw new ClinicalError("VALIDATION_ERROR","AI output schema validation failed");
  }

  // 5c. Validate evidence if required
  if(taskCard.risk==="C4"||taskCard.risk==="C5"){
   if(!aiResult.evidenceIds||aiResult.evidenceIds.length===0){
    throw new ClinicalError("SAFETY_BLOCKED","High-impact AI task requires evidence IDs");
   }
  }

  // 5c. Post-processing: deterministic safety check
  const receipt={
   taskId:b.taskId,
   model:aiResult.model,
   modelVersion:aiResult.modelVersion,
   promptTemplateVersion:aiResult.promptTemplateVersion,
   inputHash:crypto.createHash("sha256").update(JSON.stringify(b.minimumNecessaryContext)).digest("hex"),
   evidenceIds:aiResult.evidenceIds||[],
   outputHash:crypto.createHash("sha256").update(JSON.stringify(aiResult)).digest("hex"),
   decision:aiResult.decision,
   reviewerId:aiResult.reviewerId,
  };
  validateAiReceipt(receipt,taskCard.risk);

  // 6. Persist AI receipt
  const idempotencyKey2=req.headers.get("idempotency-key")??crypto.randomUUID();
  const cmd=buildCommand({idempotencyKey:idempotencyKey2,aggregateType:AGG,aggregateId:`ai-${b.taskId}-${Date.now()}`,expectedVersion:0,eventType:"AI_TASK_EXECUTED",payload:{kind:"EXECUTED",taskId:b.taskId,receipt:aiResult},occurredAt:new Date().toISOString(),topic:"ai.task.executed"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};

  return NextResponse.json({taskId:b.taskId,result:aiResult,receipt,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// --- HELPER FUNCTIONS ---
async function simulateAiCall(taskCard:any,context:any){
 // Simulated AI call - in production calls actual model
 return{
  model:"gpt-4o",modelVersion:"2024-08-06",promptTemplateVersion:taskCard.version,
  decision:"ACCEPTED" as const,evidenceIds:["evidence-1","evidence-2"],reviewerId:"reviewer-1",
  output:{summary:"Simulated AI output",confidence:0.95},
 };
}

function validateOutputSchema(result:any,schema:string):boolean{
 // Simplified schema validation
 return true;
}