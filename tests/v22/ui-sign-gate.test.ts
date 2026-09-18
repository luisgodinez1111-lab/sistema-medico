import{describe,it,expect}from"vitest";
import{initialSignGate,signGateReducer,gateView,isPending,canSign,activeTags,SignGateError,MIN_EVIDENCE}from"../../packages/ui-sign-gate/src";
import{assertNoForbidden}from"../../packages/design-system/src";
// GUX-001 — pruebas del núcleo canónico (máquina de estados). Cierra la parte testeable del gate del contrato.
describe("SignGate state machine (GUX-001)",()=>{
 it("con crítico abierto arranca BLOCKED; sin críticos, READY",()=>{
  expect(initialSignGate(1).phase).toBe("BLOCKED");
  expect(initialSignGate(0).phase).toBe("READY");
 });
 it("no se puede firmar con un pendiente crítico abierto",()=>{
  const s=initialSignGate(1);
  expect(canSign(s)).toBe(false);
  expect(()=>signGateReducer(s,{type:"SIGN"})).toThrow(SignGateError); // SIGN_ONLY_FROM_READY
 });
 it("resolver EXIGE evidencia (no basta reconocer)",()=>{
  const s=initialSignGate(1);
  expect(()=>signGateReducer(s,{type:"RESOLVE",evidence:"corto"})).toThrow(/EVIDENCE_REQUIRED/);
  expect(signGateReducer(s,{type:"ACKNOWLEDGE"}).phase).toBe("BLOCKED"); // reconocer NO resuelve
 });
 it("flujo completo: BLOCKED -> RESOLVING -> READY -> SIGNING -> SIGNED",()=>{
  let s=initialSignGate(1);
  s=signGateReducer(s,{type:"RESOLVE",evidence:"Paciente contactado; K 5.1 tras tratamiento; ECG sin cambios"});
  expect(s.phase).toBe("RESOLVING");expect(isPending(s)).toBe(true); // pendiente != éxito
  s=signGateReducer(s,{type:"RESOLUTION_CONFIRMED"});
  expect(s.phase).toBe("READY");expect(s.criticalOpen).toBe(0);expect(canSign(s)).toBe(true);
  s=signGateReducer(s,{type:"SIGN"});
  expect(s.phase).toBe("SIGNING");expect(isPending(s)).toBe(true);
  s=signGateReducer(s,{type:"SIGN_CONFIRMED"});
  expect(s.phase).toBe("SIGNED");
 });
 it("pending != success: RESOLVING/SIGNING marcan UNKNOWN_COMMIT_STATE",()=>{
  const resolving=signGateReducer(initialSignGate(1),{type:"RESOLVE",evidence:"evidencia clínica suficiente aquí"});
  expect(activeTags(resolving)).toContain("UNKNOWN_COMMIT_STATE");
 });
 it("el guard de estados prohibidos bloquea CRITICAL_OPEN+SIGN_READY y DRAFT+SIGNED_STYLE",()=>{
  expect(()=>assertNoForbidden(["CRITICAL_OPEN","SIGN_READY"])).toThrow(/FORBIDDEN_STATE/);
  expect(()=>assertNoForbidden(["DRAFT","SIGNED_STYLE"])).toThrow(/FORBIDDEN_STATE/);
  expect(()=>assertNoForbidden(["UNKNOWN_COMMIT_STATE","SUCCESS"])).toThrow(/FORBIDDEN_STATE/);
 });
 it("ningún estado alcanzable del flujo viola el guard",()=>{
  let s=initialSignGate(1);
  const path:Array<Parameters<typeof signGateReducer>[1]>=[{type:"RESOLVE",evidence:"evidencia clínica del seguimiento"},{type:"RESOLUTION_CONFIRMED"},{type:"SIGN"},{type:"SIGN_CONFIRMED"}];
  for(const e of path){s=signGateReducer(s,e);expect(()=>assertNoForbidden(activeTags(s))).not.toThrow();}
 });
 it("gateView da tono/label/testid por fase",()=>{
  expect(gateView(initialSignGate(1)).tone).toBe("critical");
  expect(gateView({phase:"SIGNED",criticalOpen:0,evidence:"x"}).testid).toBe("gate-signed");
  expect(MIN_EVIDENCE).toBeGreaterThan(0);
 });
});
