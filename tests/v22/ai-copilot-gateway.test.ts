import{describe,it,expect}from"vitest";
import{evaluateAiRequest}from"../../apps/web/lib/ai-copilot-gateway";
// EPIC CB (ADR-0220 fase 1) — Choke point del copilot: gates puros, SIN IA.
const ok={copilotEnabled:true,budgetSafe:true,hasEvidence:true,humanApproved:true};
describe("evaluateAiRequest",()=>{
 it("master kill-switch OFF -> DISABLED (aunque todo lo demás esté bien)",()=>{
  expect(evaluateAiRequest("SUMMARIZE",{...ok,copilotEnabled:false}).status).toBe("DISABLED");
 });
 it("acciones de ALTO riesgo son autoridad HUMANA -> SAFETY_BLOCKED",()=>{
  for(const a of["ORDER","PRESCRIBE","SIGN","CLOSE_CRITICAL"]as const){
   const d=evaluateAiRequest(a,ok);
   expect(d.status).toBe("SAFETY_BLOCKED");expect(d.reason).toBe("HUMAN_AUTHORITY_REQUIRED");
  }
 });
 it("SUMMARIZE (C3) con todo bien -> ALLOWED",()=>{
  expect(evaluateAiRequest("SUMMARIZE",ok).status).toBe("ALLOWED");
 });
 it("presupuesto inseguro (críticos abiertos) -> SAFETY_BLOCKED",()=>{
  expect(evaluateAiRequest("SUMMARIZE",{...ok,budgetSafe:false})).toMatchObject({status:"SAFETY_BLOCKED",reason:"OPEN_CRITICAL_ITEMS"});
 });
 it("SUGGEST (C4) sin evidencia -> SAFETY_BLOCKED (evidencia requerida)",()=>{
  expect(evaluateAiRequest("SUGGEST",{...ok,hasEvidence:false})).toMatchObject({status:"SAFETY_BLOCKED",reason:"EVIDENCE_REQUIRED"});
 });
 it("SUGGEST (C4) con evidencia pero sin aprobación humana -> ABSTAIN",()=>{
  expect(evaluateAiRequest("SUGGEST",{...ok,humanApproved:false})).toMatchObject({status:"ABSTAIN",reason:"HUMAN_APPROVAL_REQUIRED"});
 });
 it("el riesgo se asigna por acción",()=>{
  expect(evaluateAiRequest("SUMMARIZE",ok).risk).toBe("C3");
  expect(evaluateAiRequest("SUGGEST",ok).risk).toBe("C4");
  expect(evaluateAiRequest("PRESCRIBE",ok).risk).toBe("C5");
 });
});
