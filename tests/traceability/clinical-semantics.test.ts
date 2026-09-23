import { describe,it,expect } from "vitest";
import { verifyAnalyteReadings } from "../../apps/web/lib/analyte-inputs";
// Auditoría 2026-09-19 (K-03): el contrato "no computable" que se probaba en `packages/contracts` no lo usaba nadie. El
// contrato REAL es `verifyAnalyteReadings` (apps/web/lib/analyte-inputs.ts), que alimenta a todas las calculadoras.
describe("explicit computation semantics (contrato real)",()=>{
 it("never converts missing/unsupported to a normal value: sin lectura -> ok:false con el analito que falta",()=>{
  const r=verifyAnalyteReadings([{analyte:"CREATININE",maxAgeDays:365}],[undefined],{now:new Date("2026-09-22T00:00:00Z")});
  expect(r.ok).toBe(false);if(!r.ok){expect(r.missing).toEqual(["CREATININE"]);expect(r.reason).toMatch(/creatinina/i);}
 });
 it("una lectura obsoleta tampoco se computa",()=>{
  const r=verifyAnalyteReadings([{analyte:"CREATININE",maxAgeDays:30}],[{analyte:"CREATININE",rawValue:"1.1",value:1.1,unit:"mg/dL",canonicalUnit:"mg/dL",unitAssumed:false,occurredAt:"2025-01-01T00:00:00Z",resultId:"r1",specimenId:null}],{now:new Date("2026-09-22T00:00:00Z")});
  expect(r.ok).toBe(false);if(!r.ok)expect(r.stale.length).toBe(1);
 });
});
