import{describe,it,expect}from"vitest";
import{evaluatePrescriptionSafety,decideOverride,OVERRIDABLE_BARRIERS,HARD_BARRIERS,type PrescriptionSafetyInput}from"../../packages/prescription-safety/src";
import{checkDoseCeiling,checkPediatricDose}from"../../packages/medication-validation/src";
import{assertPhysicianCredentials}from"../../apps/web/lib/physician-profile-lifecycle";
import{ClinicalError}from"../../packages/runtime-errors/src";
// Auditoría 2026-09-19 (G-01/G-02): caso de seguridad de CAP-MEDICATION-001 con oráculos EJECUTABLES sobre el código que corre
// (no sobre una máquina paralela). Cada `it` es la contrapartida de un invariante de safety/core-invariants.json.
const base:PrescriptionSafetyInput={drugCode:"ibuprofeno-400",dose:"400mg",route:"Oral",frequency:"c/8h",allergies:[],activeDrugCodes:[],activeConditionCodes:[],egfr:90,weightKg:70,ageYears:40};
describe("INV-CORE-0009 — lo no evaluado nunca es seguro",()=>{
 it("fármaco fuera de catálogo: ninguna barrera dependiente queda PASSED, el veredicto no es CLEAR y se exige confirmación",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"apixaban"});
  expect(e.verdict).not.toBe("CLEAR");expect(e.requiresAcknowledgement).toBe(true);
  for(const id of["interaction","duplicate","contraindication","doseCeiling","renal"])expect(e.barriers.find(b=>b.id===id)?.status).toBe("NOT_EVALUATED");
 });
 it("sin eGFR con un fármaco que exige ajuste renal, o menor sin peso: NOT_EVALUATED, nunca PASSED",()=>{
  expect(evaluatePrescriptionSafety({...base,drugCode:"metformina-850",dose:"850mg",frequency:"c/12h",egfr:undefined}).barriers.find(b=>b.id==="renal")?.status).toBe("NOT_EVALUATED");
  expect(evaluatePrescriptionSafety({...base,drugCode:"paracetamol-500",dose:"500mg",frequency:"c/6h",weightKg:undefined,ageYears:6}).barriers.find(b=>b.id==="pediatricDose")?.status).toBe("NOT_EVALUATED");
 });
});
describe("INV-CORE-0010 — un bloqueo solo se levanta nombrándolo con justificación; los duros nunca",()=>{
 it("alergia grave bloquea; anular exige nombrar la barrera y justificar; nombrar una que no bloquea se rechaza",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"amoxicilina-500",dose:"500mg",allergies:[{substance:"penicilina",severity:"SEVERE",reaction:"anafilaxia"}]});
  expect(e.blockedOverridable).toEqual(["allergy"]);
  expect(decideOverride(e,undefined).ok).toBe(false);
  expect(decideOverride(e,{barriers:["allergy"],justification:"corta"}).ok).toBe(false);
  expect(decideOverride(e,{barriers:["allergy","renal"],justification:"Desensibilización programada con alergología"}).ok).toBe(false);
  expect(decideOverride(e,{barriers:["allergy"],justification:"Desensibilización programada con alergología"}).ok).toBe(true);
 });
 it("las listas anulable/dura son disjuntas y las duras incluyen techo de dosis y dosis pediátrica",()=>{
  expect(OVERRIDABLE_BARRIERS.some(b=>(HARD_BARRIERS as readonly string[]).includes(b))).toBe(false);
  expect(HARD_BARRIERS).toEqual(expect.arrayContaining(["doseCeiling","pediatricDose","order"]));
 });
});
describe("INV-CORE-0011 — la dosis por encima del techo diario o del máximo pediátrico se BLOQUEA sin anulación",()=>{
 it("paracetamol 2000 mg c/4h (12 g/día) y 500 mg c/6h en 10 kg (200 mg/kg/día)",()=>{
  const dc=checkDoseCeiling("paracetamol","2000mg","c/4h","paracetamol-500");expect(dc.checked&&dc.exceeded).toBe(true);
  const pd=checkPediatricDose("paracetamol","500mg","c/6h",10);expect(pd.checked&&pd.exceeded).toBe(true);
  const e=evaluatePrescriptionSafety({...base,drugCode:"paracetamol-500",dose:"2000mg",frequency:"c/4h"});
  expect(e.blockedHard).toEqual(["doseCeiling"]);
  const d=decideOverride(e,{barriers:["allergy","interaction","duplicate","contraindication","renal"],justification:"Intento de anular todo lo anulable"});
  expect(d.ok).toBe(false);if(!d.ok)expect(d.code).toBe("HARD_BLOCK");
 });
});
describe("INV-CORE-0012 — prescribir y firmar exigen identidad profesional registrada",()=>{
 it("sin credenciales -> PRECONDITION_REQUIRED con razón estable; con credenciales pasan",()=>{
  let err:unknown;try{assertPhysicianCredentials(null);}catch(e){err=e;}
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("PRECONDITION_REQUIRED");expect((err as ClinicalError).details?.["reason"]).toBe("PHYSICIAN_CREDENTIALS_REQUIRED");
  expect(assertPhysicianCredentials({fullName:"Dra. Prueba",cedulaProfesional:"1234567",institution:"UNAM",setAt:"2026-09-22T00:00:00Z"}).cedulaProfesional).toBe("1234567");
 });
});
