import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{aiAuthority,type AIAction}from"../../../packages/ai-authority-gate/src";
import{enforceEnvelope,type Envelope}from"../../../packages/ai-gateway/src";
import{budgetStatus}from"../../../packages/operational-safety-budget/src";
import{sliSpan}from"../../../packages/observability/src";
import{gradeCandidateSafety,type CandidateOutput}from"../../../packages/ai-eval-harness/src";
import{countOpenCriticalResults,countOpenCriticalVitals,countUnresolvedCriticalObligations}from"./clinical-runtime";
import{gatherClinicalIntelligence}from"./clinical-intelligence-summary";
import{toHttpError}from"./http-errors";
import{resolveVerified,principalFrom,parseJson}from"./http-command";
// EPIC CB (ADR-0220, fase 1) — Choke point de seguridad del AI copilot, SIN IA generativa (R6 EN PAUSA).
// TODA llamada de "copilot" pasa por aquí y hereda: master kill-switch, gate de autoridad (ORDER/PRESCRIBE/
// SIGN -> humano), envelope (evidencia/aprobación), presupuesto de seguridad (no correr con críticos abiertos),
// provenance AI_SUGGESTED (nunca auto-promovido), y auditoría SLI sin PHI. El "proveedor" es DETERMINISTA.

const RISK:Record<AIAction,"C2"|"C3"|"C4"|"C5">={SUMMARIZE:"C3",EXTRACT:"C3",SUGGEST:"C4",ORDER:"C5",PRESCRIBE:"C5",SIGN:"C5",CLOSE_CRITICAL:"C5"};
export type AiDecisionStatus="ALLOWED"|"SAFETY_BLOCKED"|"ABSTAIN"|"DISABLED";
export type AiDecision=Readonly<{status:AiDecisionStatus;reason:string;risk:string}>;
// Decisión PURA (testeable sin BD): combina master switch + autoridad + presupuesto + envelope.
export function evaluateAiRequest(action:AIAction,c:{copilotEnabled:boolean;budgetSafe:boolean;hasEvidence:boolean;humanApproved:boolean}):AiDecision{
 const risk=RISK[action]??"C5";
 if(!c.copilotEnabled)return{status:"DISABLED",reason:"AI_COPILOT_DISABLED",risk}; // master kill-switch (OFF por defecto)
 const auth=aiAuthority(action);
 if(!auth.allowed)return{status:"SAFETY_BLOCKED",reason:auth.reason,risk}; // ORDER/PRESCRIBE/SIGN/CLOSE_CRITICAL -> humano
 if(!c.budgetSafe)return{status:"SAFETY_BLOCKED",reason:"OPEN_CRITICAL_ITEMS",risk}; // no correr IA con críticos sin atender
 const env:Envelope={id:`SE-${action}`,risk,human_approval_required:action==="SUGGEST",kill_switch:true,evidence_required:risk==="C4"||risk==="C5",failure_mode:"ABSTAIN"};
 const e=enforceEnvelope(env,{killSwitchEnabled:c.copilotEnabled,hasEvidence:c.hasEvidence,humanApproved:c.humanApproved});
 if(e.status==="SAFETY_BLOCKED")return{status:"SAFETY_BLOCKED",reason:"EVIDENCE_REQUIRED",risk};
 if(e.status==="ABSTAIN")return{status:"ABSTAIN",reason:"HUMAN_APPROVAL_REQUIRED",risk};
 return{status:"ALLOWED",reason:"BOUNDED_AI_ACTION",risk};
}

export const AssistBody=z.object({action:z.enum(["SUMMARIZE","EXTRACT","SUGGEST","ORDER","PRESCRIBE","SIGN","CLOSE_CRITICAL"]),patientId:z.string().uuid().optional(),hasEvidence:z.boolean().default(false),humanApproved:z.boolean().default(false)});
export async function handleAiAssist(req:Request):Promise<Response>{
 const span=sliSpan("workflow","ai_assist",crypto.randomUUID());let statusCode="DISABLED";let tenantId="";
 try{
  const{claims,ctx}=resolveVerified(req);tenantId=claims.tenantId;
  authorize(principalFrom(claims),{scope:"ai:invoke",purpose:"TREATMENT"});
  const b=await parseJson(req,AssistBody);
  // Master kill-switch: OFF por defecto. Con R6 en pausa NUNCA está ON en prod -> el copilot es inerte.
  const copilotEnabled=process.env.AI_COPILOT_ENABLED==="true";
  // Presupuesto de seguridad: no correr el copilot mientras el paciente tenga críticos sin atender.
  let budgetSafe=true;
  if(b.patientId){
   const[r,v,o]=await Promise.all([countOpenCriticalResults(ctx,b.patientId),countOpenCriticalVitals(ctx,b.patientId),countUnresolvedCriticalObligations(ctx,b.patientId)]);
   budgetSafe=budgetStatus({unownedCritical:r+v,overdueCritical:o,reconciliationBacklog:0,deadLetters:0,projectionGaps:0}).safe;
  }
  const decision=evaluateAiRequest(b.action,{copilotEnabled,budgetSafe,hasEvidence:b.hasEvidence,humanApproved:b.humanApproved});
  statusCode=decision.status;
  if(decision.status==="DISABLED"){span.end("success",{code:"DISABLED",tenantId});throw new ClinicalError("DEPENDENCY_UNAVAILABLE","AI copilot deshabilitado (kill-switch)",{reason:decision.reason});}
  if(decision.status==="SAFETY_BLOCKED"){span.end("success",{code:"SAFETY_BLOCKED",tenantId});throw new ClinicalError("SAFETY_BLOCKED",`Acción de IA bloqueada: ${decision.reason}`,{risk:decision.risk});}
  // Base envelope de la respuesta: NUNCA generativa en fase 1, NUNCA promovida al registro.
  const base={action:b.action,risk:decision.risk,provenance:"AI_SUGGESTED" as const,generative:false as const,promoted:false as const};
  if(decision.status==="ABSTAIN"){span.end("success",{code:"ABSTAIN",tenantId});return NextResponse.json({...base,status:"ABSTAIN",reason:decision.reason},{status:200});}
  // ALLOWED: "proveedor" DETERMINISTA (no LLM). SUMMARIZE devuelve el resumen de inteligencia clínica (Epic BS),
  // citado al motor determinista. EXTRACT/SUGGEST requieren proveedor de IA real (no activado) -> se abstiene.
  if(b.action==="SUMMARIZE"&&b.patientId){
   const r=await gatherClinicalIntelligence(ctx,b.patientId);
   // SHADOW MODE (ADR-0220 fase 2): califica un candidato en paralelo y registra el resultado SIN mostrarlo
   // al médico. Flag independiente del kill-switch. La respuesta al clínico NO cambia (invariante de no-fuga).
   if(process.env.AI_COPILOT_SHADOW==="true"){
    const candidate:CandidateOutput={kind:"CLAIM",text:"resumen",citations:["deterministic-engine"]};
    const verdict=gradeCandidateSafety(candidate);
    sliSpan("workflow","ai_shadow",crypto.randomUUID()).end("success",{code:verdict.safe?"SHADOW_SAFE":"SHADOW_UNSAFE",tenantId});
   }
   span.end("success",{code:"ALLOWED",tenantId});
   return NextResponse.json({...base,status:"ALLOWED",content:{findings:r.findings,summary:r.summary},citations:["deterministic-engine"],note:"Contenido determinista (sin IA generativa); el médico revisa antes de promover"},{status:200});
  }
  span.end("success",{code:"ABSTAIN",tenantId});
  return NextResponse.json({...base,status:"ABSTAIN",reason:"PROVIDER_NOT_ACTIVATED",note:"Requiere proveedor de IA real (R6 en pausa)"},{status:200});
 }catch(e){
  if(statusCode==="DISABLED"||statusCode==="SAFETY_BLOCKED"){/* SLI ya emitido */}else span.end("error",{code:(e as{code?:string}).code??"ERROR",tenantId});
  const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});
 }
}
