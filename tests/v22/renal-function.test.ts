import{describe,it,expect}from"vitest";
import{computeEGFR,ckdStage}from"../../packages/renal-function/src";
// EPIC BL — eGFR CKD-EPI 2021 (race-free) + estadificación KDIGO.
describe("computeEGFR (CKD-EPI 2021)",()=>{
 it("hombre 50a, Scr 1.0 -> ~92 mL/min, G1",()=>{
  const r=computeEGFR(1.0,50,"MALE")!;
  expect(r.egfr).toBeCloseTo(91.7,0);
  expect(r.stage).toBe("G1");
 });
 it("mujer 50a, Scr 1.0 -> ~69 mL/min, G2",()=>{
  const r=computeEGFR(1.0,50,"FEMALE")!;
  expect(r.egfr).toBeCloseTo(68.6,0);
  expect(r.stage).toBe("G2");
 });
 it("hombre 70a, Scr 2.5 -> ERC avanzada (G3b/G4)",()=>{
  const r=computeEGFR(2.5,70,"MALE")!;
  expect(r.egfr).toBeLessThan(45);
  expect(["G3b","G4"]).toContain(r.stage);
 });
 it("a mayor creatinina, menor eGFR (monotonía)",()=>{
  const a=computeEGFR(1.0,60,"MALE")!.egfr;const b=computeEGFR(2.0,60,"MALE")!.egfr;
  expect(b).toBeLessThan(a);
 });
 it("valores inválidos -> undefined (no falso resultado)",()=>{
  expect(computeEGFR(0,50,"MALE")).toBeUndefined();
  expect(computeEGFR(1.0,0,"MALE")).toBeUndefined();
  expect(computeEGFR(NaN,50,"FEMALE")).toBeUndefined();
 });
 it("ckdStage cubre G1..G5 por umbrales KDIGO",()=>{
  expect(ckdStage(95).stage).toBe("G1");
  expect(ckdStage(75).stage).toBe("G2");
  expect(ckdStage(50).stage).toBe("G3a");
  expect(ckdStage(35).stage).toBe("G3b");
  expect(ckdStage(20).stage).toBe("G4");
  expect(ckdStage(10).stage).toBe("G5");
 });
});
