
import {describe,it,expect} from "vitest";
import {enforceEnvelope} from "../../packages/ai-gateway/src/enforce-envelope";
const e={id:"SE-X",risk:"C5" as const,human_approval_required:true,kill_switch:true,evidence_required:true,failure_mode:"SAFETY_BLOCKED" as const};
describe("AI Safety Envelope runtime",()=>{
 it("blocks missing evidence",()=>expect(enforceEnvelope(e,{killSwitchEnabled:true,hasEvidence:false,humanApproved:true}).status).toBe("SAFETY_BLOCKED"));
 it("abstains without human approval",()=>expect(enforceEnvelope(e,{killSwitchEnabled:true,hasEvidence:true,humanApproved:false}).status).toBe("ABSTAIN"));
 // Auditoría R02b (R2B-006, lote 17): esta rama LANZABA un `Error` nativo mientras las otras tres devolvían un estado
 // tipado. El error salía por el `catch` genérico del handler como un 500 sin estructura, o sea: la barrera actuaba, pero se
 // leía como «el sistema se rompió». Ahora las cuatro salidas son el mismo tipo y el motivo viaja en `reason`.
 it("bloquea —con estado tipado, no con una excepción— si el kill switch no está disponible",()=>{
  const v=enforceEnvelope(e,{killSwitchEnabled:false,hasEvidence:true,humanApproved:true});
  expect(v.status).toBe("SAFETY_BLOCKED");
  expect(v.reason).toMatch(/KILL_SWITCH/);
  // Y el sobre cuyo propio `kill_switch` es false tampoco pasa: la condición previa es que EXISTA el interruptor.
  expect(enforceEnvelope({...e,kill_switch:false},{killSwitchEnabled:true,hasEvidence:true,humanApproved:true}).status).toBe("SAFETY_BLOCKED");
 });
 it("cada bloqueo dice POR QUÉ: un estado sin motivo obliga a leer el código para interpretarlo",()=>{
  expect(enforceEnvelope(e,{killSwitchEnabled:true,hasEvidence:false,humanApproved:true}).reason).toMatch(/EVIDENCE_REQUIRED/);
  expect(enforceEnvelope(e,{killSwitchEnabled:true,hasEvidence:true,humanApproved:false}).reason).toMatch(/HUMAN_APPROVAL_REQUIRED/);
  // Y cuando se permite, no hay motivo que explicar.
  const ok=enforceEnvelope({...e,risk:"C2",human_approval_required:false,evidence_required:false},{killSwitchEnabled:true,hasEvidence:false,humanApproved:false});
  expect(ok.status).toBe("ALLOWED");expect(ok.reason).toBeUndefined();
 });
});
