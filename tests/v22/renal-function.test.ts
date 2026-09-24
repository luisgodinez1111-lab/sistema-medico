import{describe,it,expect}from"vitest";
import{computeEGFR,ckdStage,egfrCheck,EGFR_BOUNDS,schwartzBedside,schwartzCheck,SCHWARTZ_AGE_RANGE}from"../../packages/renal-function/src";
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

// Auditoría 2026-09-19, anexo R03 (R03-01): el DOMINIO de CKD-EPI y la ecuación pediátrica que faltaba.
describe("dominio de CKD-EPI y Schwartz pediátrico (R03-01)",()=>{
 it("la función YA NO calcula en pediatría (el comentario lo afirmaba; el código no lo comprobaba)",()=>{
  // El caso exacto del anexo: computeEGFR(0.4, 3, "FEMALE") devolvía un eGFR con estadio KDIGO para un niño de 3 años.
  expect(computeEGFR(0.4,3,"FEMALE")).toBeUndefined();
  expect(egfrCheck(0.4,3)?.reasonCode).toBe("PEDIATRIC_REQUIRES_SCHWARTZ");
  expect(egfrCheck(1.0,18)).toBeUndefined(); // 18 años sí entra
 });
 it("una creatinina en µmol/L no se toma por mg/dL (88.4 daba «G5 falla renal» a un riñón normal)",()=>{
  expect(computeEGFR(88.4,50,"MALE")).toBeUndefined();
  const rej=egfrCheck(88.4,50);
  expect(rej?.reasonCode).toBe("IMPLAUSIBLE_CREATININE");
  expect(rej?.detail).toMatch(/88\.4/); // el mensaje enseña la conversión
  expect(computeEGFR(0.05,50,"MALE")).toBeUndefined();
 });
 it("la edad tiene cota superior (130 años se calculaba sin objeción)",()=>{
  expect(egfrCheck(1.0,130)?.reasonCode).toBe("AGE_OUT_OF_RANGE");
  expect(computeEGFR(1.0,130,"MALE")).toBeUndefined();
  expect(EGFR_BOUNDS.ageYears).toEqual([18,120]);
 });
 it("Schwartz de cabecera: 0.413 × talla / creatinina (Schwartz 2009)",()=>{
  const r=schwartzBedside(110,0.4,5)!;
  expect(r.egfr).toBe(113.6); // 0.413*110/0.4 = 113.575
  expect(r.equation).toBe("SCHWARTZ_BEDSIDE_2009");
  expect(r.ckdStaged).toBe(false); // no se estadifica como ERC
 });
 it("Schwartz declara su propio dominio (lactantes y adultos fuera)",()=>{
  expect(schwartzCheck(50,0.3,0.5)?.reasonCode).toBe("OUT_OF_AGE_RANGE");
  expect(schwartzCheck(170,1.0,25)?.reasonCode).toBe("OUT_OF_AGE_RANGE");
  expect(schwartzCheck(300,0.4,5)?.reasonCode).toBe("IMPLAUSIBLE_HEIGHT");
  expect(schwartzCheck(110,88.4,5)?.reasonCode).toBe("IMPLAUSIBLE_CREATININE");
  expect(schwartzBedside(NaN,0.4,5)).toBeUndefined();
  expect(SCHWARTZ_AGE_RANGE).toEqual([1,17]);
 });
 it("las dos ecuaciones cubren el rango de edad sin hueco entre 17 y 18 años",()=>{
  expect(schwartzCheck(160,0.8,17)).toBeUndefined();  // 17 -> Schwartz
  expect(egfrCheck(0.8,18)).toBeUndefined();          // 18 -> CKD-EPI
 });
});
