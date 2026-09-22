import{describe,it,expect}from"vitest";
import{evaluatePrescriptionSafety,summarizeForEvent,ageInYears,decideOverride,OVERRIDABLE_BARRIERS,HARD_BARRIERS,OVERRIDE_MIN_JUSTIFICATION,type PrescriptionSafetyInput,type BarrierId}from"../../packages/prescription-safety/src";
// Auditoría 2026-09-19 (C-03, C-04, C-05, C-14, C-16): "no pude evaluar" NUNCA se presenta como "seguro".
// Estos casos fijan el comportamiento correcto del evaluador ÚNICO que comparten el dry-run y PRESCRIBE.
const base:PrescriptionSafetyInput={drugCode:"ibuprofeno-400",dose:"400mg",route:"Oral",frequency:"c/8h",
 allergies:[],activeDrugCodes:[],activeConditionCodes:[],egfr:90,weightKg:70,ageYears:40};
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
 it("amoxicilina con TFG 10 -> CAUTION renal (C-15: antes 'sin regla'); no fuerza confirmación pero el veredicto es REVIEW",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"amoxicilina-500",dose:"500mg",frequency:"c/8h",egfr:10});
  expect(st(e,"renal")).toBe("CAUTION");expect(e.verdict).toBe("REVIEW");expect(e.requiresAcknowledgement).toBe(false);
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
 it("dosis en tabletas SIN concentración en el código ('2 tab' de 'ibuprofeno') -> NOT_EVALUATED, no 'OK'",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"ibuprofeno",dose:"2 tab"});
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
// Auditoría 2026-09-19 (U-19): anulación justificada de un bloqueo. Nombrada barrera por barrera, con justificación, y
// NUNCA sobre techo de dosis / dosis pediátrica / orden mal formada.
describe("anulación justificada de un bloqueo (U-19)",()=>{
 const J="Paciente en diálisis trisemanal; dosis acordada con nefrología";
 it("las listas de barreras anulables y duras son complementarias y cubren todas las barreras",()=>{
  const all:BarrierId[]=["order","catalog","allergy","interaction","duplicate","contraindication","doseCeiling","pediatricDose","renal"];
  expect([...OVERRIDABLE_BARRIERS,...HARD_BARRIERS].sort()).toEqual([...all].sort());
  expect(OVERRIDABLE_BARRIERS).not.toContain("doseCeiling");expect(OVERRIDABLE_BARRIERS).not.toContain("pediatricDose");
 });
 it("sin bloqueo: ok y sin anulación que registrar; nombrar una barrera que no bloquea se rechaza",()=>{
  const e=evaluatePrescriptionSafety(base);
  expect(e.blockedOverridable).toEqual([]);expect(e.blockedHard).toEqual([]);
  expect(decideOverride(e,undefined)).toEqual({ok:true,override:null});
  const d=decideOverride(e,{barriers:["renal"],justification:J});
  expect(d.ok).toBe(false);if(!d.ok){expect(d.code).toBe("OVERRIDE_NOT_BLOCKED");expect(d.unmatched).toEqual(["renal"]);}
 });
 it("bloqueo renal (metformina, TFG 20): sin anulación -> OVERRIDE_REQUIRED nombrando lo que falta; con anulación completa -> ok y queda registrada",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"metformina-850",dose:"850mg",frequency:"c/12h",egfr:20});
  expect(e.blockedOverridable).toEqual(["renal"]);expect(e.blockedHard).toEqual([]);
  const d0=decideOverride(e,undefined);expect(d0.ok).toBe(false);if(!d0.ok){expect(d0.code).toBe("OVERRIDE_REQUIRED");expect(d0.unmatched).toEqual(["renal"]);}
  const d1=decideOverride(e,{barriers:["renal"],justification:"corto"});expect(d1.ok).toBe(false);if(!d1.ok)expect(d1.code).toBe("JUSTIFICATION_TOO_SHORT");
  expect(J.length).toBeGreaterThanOrEqual(OVERRIDE_MIN_JUSTIFICATION);
  const d2=decideOverride(e,{barriers:["renal"],justification:`  ${J}  `});
  expect(d2).toEqual({ok:true,override:{barriers:["renal"],justification:J}});
  const s=summarizeForEvent(e,{acknowledged:false},d2.ok?{override:d2.override,by:"user-1"}:undefined);
  expect(s.override).toEqual({barriers:["renal"],justification:J,by:"user-1"});
  expect(summarizeForEvent(e,{acknowledged:false}).override).toBeUndefined();
 });
 it("dos bloqueos anulables: hay que nombrar los dos (uno solo no basta)",()=>{
  // duplicidad (naproxeno activo) + renal (ibuprofeno con TFG 25 exige precaución/bloqueo según regla) -> se usa contraindicación por dx
  const e=evaluatePrescriptionSafety({...base,activeDrugCodes:["naproxeno-250"],egfr:20});
  expect(e.blockedOverridable.length).toBeGreaterThanOrEqual(2);
  const d=decideOverride(e,{barriers:["duplicate"],justification:J});
  expect(d.ok).toBe(false);if(!d.ok){expect(d.code).toBe("OVERRIDE_REQUIRED");expect(d.unmatched).toEqual(e.blockedOverridable.filter(x=>x!=="duplicate"));}
  const all=decideOverride(e,{barriers:e.blockedOverridable,justification:J});expect(all.ok).toBe(true);
 });
 it("techo de dosis y dosis pediátrica NO se anulan con ninguna justificación (HARD_BLOCK)",()=>{
  const adult=evaluatePrescriptionSafety({...base,drugCode:"paracetamol-500",dose:"2000mg",frequency:"c/4h"});
  expect(adult.blockedHard).toEqual(["doseCeiling"]);
  const d=decideOverride(adult,{barriers:["renal","allergy"],justification:J});
  expect(d.ok).toBe(false);if(!d.ok){expect(d.code).toBe("HARD_BLOCK");expect(d.hard).toEqual(["doseCeiling"]);}
  const child=evaluatePrescriptionSafety({...base,drugCode:"paracetamol-500",dose:"500mg",frequency:"c/6h",weightKg:10,ageYears:2});
  expect(child.blockedHard).toContain("pediatricDose");
  expect(decideOverride(child,{barriers:[],justification:J}).ok).toBe(false);
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
describe("alergias con gravedad en el evaluador (auditoría C-06)",()=>{
 it("intolerancia leve a penicilina + ceftriaxona -> CAUTION que EXIGE confirmación (no bloquea, no se ignora)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"ceftriaxona-1g",dose:"1g",route:"IV",frequency:"c/24h",allergies:[{substance:"penicilina",severity:"MILD",reaction:"náusea"}]});
  expect(st(e,"allergy")).toBe("CAUTION");expect(e.verdict).toBe("REVIEW");expect(e.requiresAcknowledgement).toBe(true);
 });
 it("anafilaxia a penicilina + ceftriaxona -> BLOCK sin posibilidad de confirmación",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"ceftriaxona-1g",dose:"1g",route:"IV",frequency:"c/24h",allergies:[{substance:"penicilina",severity:"SEVERE",reaction:"anafilaxia"}]});
  expect(st(e,"allergy")).toBe("BLOCKED");expect(e.verdict).toBe("BLOCK");
 });
 it("alergia a AINE + diclofenaco -> BLOCK (antes: 'sin conflicto' porque diclofenaco no estaba en el catálogo)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"diclofenaco-50",dose:"50mg",frequency:"c/8h",allergies:[{substance:"AINE",severity:"SEVERE",reaction:"broncoespasmo"}]});
  expect(st(e,"allergy")).toBe("BLOCKED");
 });
});
describe("interacciones y factores del paciente en el evaluador (auditoría C-17)",()=>{
 it("sertralina activa + tramadol -> BLOCK en la barrera (la misma tabla que la pestaña informativa)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"tramadol-50",dose:"50mg",frequency:"c/8h",activeDrugCodes:["sertralina-50"]});
  expect(st(e,"interaction")).toBe("BLOCKED");
 });
 it("paciente de 78 años + AINE -> CAUTION por adulto mayor (Beers), no 'sin interacciones'",()=>{
  const e=evaluatePrescriptionSafety({...base,ageYears:78});
  expect(st(e,"interaction")).toBe("CAUTION");expect(e.barriers.find(b=>b.id==="interaction")?.detail).toMatch(/Adulto mayor/);
 });
});
describe("techos de dosis (auditoría C-15)",()=>{
 it("'2 tab' de ibuprofeno-400 c/6h = 3200 mg/día: se acota con la concentración del código (antes: NO evaluado)",()=>{
  const e=evaluatePrescriptionSafety({...base,dose:"2 tab",frequency:"c/6h"});
  expect(st(e,"doseCeiling")).toBe("PASSED");expect(e.barriers.find(b=>b.id==="doseCeiling")?.detail).toMatch(/3200 mg\/día.*concentración/);
  expect(st(evaluatePrescriptionSafety({...base,dose:"3 tab",frequency:"c/6h"}),"doseCeiling")).toBe("BLOCKED"); // 4800 > 3200
 });
 it("warfarina: sin tope fijo (por INR) -> NOT_APPLICABLE revisado, no 'sin regla'",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"warfarina-5",dose:"5mg",frequency:"c/24h"});
  expect(st(e,"doseCeiling")).toBe("NOT_APPLICABLE");
 });
 it("'PRN' sigue sin poder acotarse: NOT_EVALUATED (exige confirmación), nunca OK",()=>{
  const e=evaluatePrescriptionSafety({...base,frequency:"PRN"});
  expect(["NOT_EVALUATED","BLOCKED"]).toContain(st(e,"doseCeiling"));expect(st(e,"doseCeiling")).not.toBe("PASSED");
 });
});
