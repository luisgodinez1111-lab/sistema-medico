import{describe,it,expect}from"vitest";
import{evaluatePrescriptionSafety,summarizeForEvent,ageInYears,type PrescriptionSafetyInput,type BarrierId}from"../../packages/prescription-safety/src";
// Auditoría 2026-09-19 (C-03, C-04, C-05, C-14, C-16): "no pude evaluar" NUNCA se presenta como "seguro".
// Estos casos fijan el comportamiento correcto del evaluador ÚNICO que comparten el dry-run y PRESCRIBE.
const base:PrescriptionSafetyInput={drugCode:"ibuprofeno-400",dose:"400mg",route:"Oral",frequency:"c/8h",
 allergySubstances:[],activeDrugCodes:[],activeConditionCodes:[],egfr:90,weightKg:70,ageYears:40};
const st=(e:ReturnType<typeof evaluatePrescriptionSafety>,id:BarrierId)=>e.barriers.find(b=>b.id===id)?.status;

describe("evaluador único de seguridad de prescripción",()=>{
 it("adulto, fármaco en catálogo, datos completos -> CLEAR sin confirmación",()=>{
  const e=evaluatePrescriptionSafety(base);
  expect(e.verdict).toBe("CLEAR");expect(e.requiresAcknowledgement).toBe(false);
  expect(st(e,"doseCeiling")).toBe("PASSED");expect(st(e,"renal")).toBe("PASSED");expect(st(e,"pediatricDose")).toBe("NOT_APPLICABLE");
 });
 it("fármaco FUERA de catálogo -> nada se da por seguro y exige confirmación expresa (caso apixabán de la auditoría)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"apixaban",dose:"5mg",frequency:"c/12h",egfr:15});
  expect(e.catalogResolved).toBe(false);expect(e.verdict).toBe("REVIEW");expect(e.requiresAcknowledgement).toBe(true);
  for(const id of["catalog","interaction","duplicate","contraindication","doseCeiling","renal"] as const)expect(st(e,id)).toBe("NOT_EVALUATED");
  expect(e.barriers.some(b=>b.status==="PASSED"&&b.id!=="order")).toBe(false); // ninguna barrera clínica "pasó"
 });
 it("fármaco en catálogo SIN regla renal -> NOT_COVERED (gris), no 'OK'; no fuerza confirmación",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"amoxicilina-500",dose:"500mg",frequency:"c/8h",egfr:10});
  expect(st(e,"renal")).toBe("NOT_COVERED");expect(e.notCovered).toContain("renal");expect(e.requiresAcknowledgement).toBe(false);
 });
 it("fármaco CON regla renal y paciente SIN eGFR -> NOT_EVALUATED y confirmación",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"metformina-850",dose:"850mg",frequency:"c/12h",egfr:undefined});
  expect(st(e,"renal")).toBe("NOT_EVALUATED");expect(e.requiresAcknowledgement).toBe(true);
 });
 it("metformina con TFG 20 -> BLOCK",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"metformina-850",dose:"850mg",frequency:"c/12h",egfr:20});
  expect(st(e,"renal")).toBe("BLOCKED");expect(e.verdict).toBe("BLOCK");
 });
 it("menor de edad SIN peso -> la dosis por kg NO se verificó (el patrón clásico de sobredosis pediátrica)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"paracetamol",dose:"500mg",frequency:"c/6h",weightKg:undefined,ageYears:2});
  expect(st(e,"pediatricDose")).toBe("NOT_EVALUATED");expect(e.requiresAcknowledgement).toBe(true);
 });
 it("niño de 10 kg con paracetamol 500 mg c/6h (200 mg/kg/día) -> BLOCK por dosis pediátrica",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"paracetamol",dose:"500mg",frequency:"c/6h",weightKg:10,ageYears:2});
  expect(st(e,"pediatricDose")).toBe("BLOCKED");expect(e.verdict).toBe("BLOCK");
 });
 it("dosis no interpretable ('2 tab') con techo conocido -> NOT_EVALUATED, no 'OK'",()=>{
  const e=evaluatePrescriptionSafety({...base,dose:"2 tab"});
  expect(["NOT_EVALUATED","BLOCKED"]).toContain(st(e,"doseCeiling")); // si la orden es inválida, además bloquea por formato
  expect(st(e,"doseCeiling")).not.toBe("PASSED");
 });
 it("fármacos ACTIVOS fuera de catálogo -> interacciones con cobertura parcial declarada",()=>{
  const e=evaluatePrescriptionSafety({...base,activeDrugCodes:["coumadin-generico-raro"]});
  expect(st(e,"interaction")).toBe("NOT_EVALUATED");expect(e.unresolvedActiveDrugs).toEqual(["coumadin-generico-raro"]);
 });
 it("duplicidad terapéutica bloquea igual en el dry-run que en la escritura",()=>{
  const e=evaluatePrescriptionSafety({...base,activeDrugCodes:["naproxeno-250"]});
  expect(st(e,"duplicate")).toBe("BLOCKED");
 });
 it("el resumen persistible no contiene PHI ni valores clínicos: solo id/estado/razón y la confirmación",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"apixaban"});
  const s=summarizeForEvent(e,{acknowledged:true,justification:"Indicación de cardiología, sin alternativa en catálogo"});
  expect(s.acknowledgedUnverified).toBe(true);expect(s.catalogResolved).toBe(false);
  expect(Object.keys(s.barriers[0]!).sort()).toEqual(expect.arrayContaining(["id","status"]));
  expect(JSON.stringify(s)).not.toMatch(/eGFR|mg\/día|kg/);
 });
});
describe("ageInYears",()=>{
 it("edad cumplida en UTC y fechas inválidas",()=>{
  expect(ageInYears("2000-09-20","2026-09-19T12:00:00Z")).toBe(25);
  expect(ageInYears("2000-09-19","2026-09-19T12:00:00Z")).toBe(26);
  expect(ageInYears("no-fecha","2026-09-19T12:00:00Z")).toBeUndefined();
  expect(ageInYears("2030-01-01","2026-09-19T12:00:00Z")).toBeUndefined();
 });
});
