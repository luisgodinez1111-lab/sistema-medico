import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
import{ClinicalError}from"../../packages/runtime-errors/src";
import{foldHistory}from"../../packages/adaptive-history/src";
import{foldAdmission}from"../../packages/admission-fold/src";
import{foldAllergy}from"../../packages/allergy-fold/src";
import{foldAntecedentes}from"../../packages/antecedentes-fold/src";
import{foldAppointment}from"../../packages/appointment-fold/src";
import{foldCarePlan}from"../../packages/careplan-fold/src";
import{foldClaim}from"../../packages/claim-fold/src";
import{foldConsent}from"../../packages/consent-fold/src";
import{foldDialysis}from"../../packages/dialysis-fold/src";
import{foldDocument}from"../../packages/document-fold/src";
import{foldEncounter}from"../../packages/encounter-fold/src";
import{foldImagingOrder}from"../../packages/imaging-order/src";
import{foldImmunization}from"../../packages/immunization-fold/src";
import{foldIncident}from"../../packages/incident-fold/src";
import{foldMedication}from"../../packages/medication-fold/src";
import{foldObligation}from"../../packages/obligation-fold/src";
import{foldOrder}from"../../packages/order-fold/src";
import{foldPatient}from"../../packages/patient-fold/src";
import{foldProblem}from"../../packages/problem-fold/src";
import{foldReferral}from"../../packages/referral-fold/src";
import{foldResult}from"../../packages/result-fold/src";
import{foldSpecimen}from"../../packages/specimen-fold/src";
import{foldSurgery}from"../../packages/surgery-fold/src";
import{foldTransfusion}from"../../packages/transfusion-fold/src";
import{foldTriage}from"../../packages/triage-fold/src";
import{foldVital}from"../../packages/vital-fold/src";
import{foldWound}from"../../packages/wound-fold/src";
// Lote 11, hallazgo D4: ningún fold acepta como SU génesis un evento cuyo `kind` no es de su vocabulario (p. ej. el REGISTERED
// de un paciente leído como si fuera una alergia). Solo la génesis heredada SIN discriminador se sigue aceptando.
type Fold=(events:readonly{sequence:number;payload:Record<string,unknown>}[])=>{exists:boolean};
const FOLDS:ReadonlyArray<readonly[string,Fold]>=[
 ["adaptive-history",foldHistory as Fold],
 ["admission-fold",foldAdmission as Fold],
 ["allergy-fold",foldAllergy as Fold],
 ["antecedentes-fold",foldAntecedentes as Fold],
 ["appointment-fold",foldAppointment as Fold],
 ["careplan-fold",foldCarePlan as Fold],
 ["claim-fold",foldClaim as Fold],
 ["consent-fold",foldConsent as Fold],
 ["dialysis-fold",foldDialysis as Fold],
 ["document-fold",foldDocument as Fold],
 ["encounter-fold",foldEncounter as Fold],
 ["imaging-order",foldImagingOrder as Fold],
 ["immunization-fold",foldImmunization as Fold],
 ["incident-fold",foldIncident as Fold],
 ["medication-fold",foldMedication as Fold],
 ["obligation-fold",foldObligation as Fold],
 ["order-fold",foldOrder as Fold],
 ["patient-fold",foldPatient as Fold],
 ["problem-fold",foldProblem as Fold],
 ["referral-fold",foldReferral as Fold],
 ["result-fold",foldResult as Fold],
 ["specimen-fold",foldSpecimen as Fold],
 ["surgery-fold",foldSurgery as Fold],
 ["transfusion-fold",foldTransfusion as Fold],
 ["triage-fold",foldTriage as Fold],
 ["vital-fold",foldVital as Fold],
 ["wound-fold",foldWound as Fold]];
describe("génesis de los folds (lote 11, D4)",()=>{
 it("cubre los 27 folds con génesis heredada",()=>{expect(FOLDS.length).toBe(27);});
 // La lista de arriba es a mano; esto impide que un fold NUEVO con génesis heredada quede fuera (así entró la matriz de
 // antecedentes con la regla laxa): todo paquete cuyo kindOf decide la génesis por la secuencia 1 debe estar en FOLDS.
 it("ningún fold con génesis heredada queda fuera de la lista",()=>{
  const listed=new Set(FOLDS.map(([n])=>n));
  const conGenesis=fs.readdirSync("packages").filter(d=>{
   const f=path.join("packages",d,"src/index.ts");
   return fs.existsSync(f)&&/\.sequence===1\b/.test(fs.readFileSync(f,"utf8"));
  });
  expect(conGenesis.length).toBeGreaterThanOrEqual(27);
  expect(conGenesis.filter(d=>!listed.has(d)),"fold con génesis heredada sin cubrir").toEqual([]);
 });
 for(const[name,fold]of FOLDS){
  it(`${name}: un kind ajeno en la secuencia 1 es INVARIANT_VIOLATION, no génesis`,()=>{
   const err=(()=>{try{fold([{sequence:1,payload:{kind:"FOREIGN_AGGREGATE_KIND"}}]);}catch(e){return e;}})();
   expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("INVARIANT_VIOLATION");
  });
  it(`${name}: la génesis heredada sin discriminador sigue existiendo`,()=>{
   expect(fold([{sequence:1,payload:{}}]).exists).toBe(true);
  });
 }
});
