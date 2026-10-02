import{describe,it,expect}from"vitest";
import{derivePatientFactors}from"../../apps/web/lib/patient-factors";
import{evaluatePrescriptionSafety,type PrescriptionSafetyInput}from"../../packages/prescription-safety/src";
// Auditoría 2026-09-19, anexo R03 (R03-29): el catálogo tenía reglas fármaco–factor para el embarazo desde el lote C-17 y
// `checkInteractions` aceptaba `patientFactors`… pero la barrera de prescripción NUNCA se los pasaba: el único consumidor
// era el verificador de interacciones, donde el médico los escribe a mano. Las reglas del embarazo eran, en la práctica,
// código inalcanzable. Y la LACTANCIA no existía como factor.
const base:PrescriptionSafetyInput={drugCode:"paracetamol-500",dose:"500mg",route:"ORAL",frequency:"c/8h",
 allergies:[],activeDrugCodes:[],activeConditionCodes:[],ageYears:30,weightKg:60};
const barrera=(e:ReturnType<typeof evaluatePrescriptionSafety>,id:string)=>e.barriers.find(b=>b.id===id)!;

describe("los factores del paciente se DERIVAN del expediente (R03-29)",()=>{
 it("embarazo: del capítulo O y de Z33–Z36, no del sexo ni de la edad",()=>{
  expect(derivePatientFactors(["Z34.9"])).toContain("PREGNANCY");
  expect(derivePatientFactors(["O24.4"])).toContain("PREGNANCY");   // diabetes gestacional
  expect(derivePatientFactors(["O14.9"])).toContain("PREGNANCY");   // preeclampsia
  expect(derivePatientFactors(["I10"])).not.toContain("PREGNANCY");
  expect(derivePatientFactors([])).toEqual([]);
 });
 it("el PARTO y el PUERPERIO no son embarazo (la paciente ya no lo está)",()=>{
  expect(derivePatientFactors(["O80"])).not.toContain("PREGNANCY");     // parto único espontáneo
  expect(derivePatientFactors(["O91.2"])).not.toContain("PREGNANCY");   // mastitis puerperal
  expect(derivePatientFactors(["O91.2"])).toContain("LACTATION");
 });
 it("lactancia: de Z39.1 y de los trastornos de la lactación",()=>{
  expect(derivePatientFactors(["Z39.1"])).toEqual(["LACTATION"]);
 });
 it("también se derivan insuficiencia renal, hepática, alcohol y edad",()=>{
  expect(derivePatientFactors(["N18.3"])).toContain("RENAL_IMPAIRMENT");
  expect(derivePatientFactors(["K74.6"])).toContain("HEPATIC_IMPAIRMENT");
  expect(derivePatientFactors(["F10.2"])).toContain("ALCOHOL");
  expect(derivePatientFactors([],new Date(Date.now()-70*365.25*86_400_000).toISOString().slice(0,10))).toContain("ELDERLY");
  expect(derivePatientFactors([],new Date(Date.now()-40*365.25*86_400_000).toISOString().slice(0,10))).not.toContain("ELDERLY");
 });
 it("el ALCOHOL también se deriva del HÁBITO (antecedentes), no solo del diagnóstico F10",()=>{
  expect(derivePatientFactors([],null,{alcoholismo:true})).toContain("ALCOHOL");
  expect(derivePatientFactors([],null,{alcoholismo:false})).not.toContain("ALCOHOL");
  expect(derivePatientFactors([],null,undefined)).toEqual([]);
 });
 it("el TABAQUISMO (SMOKING) se deriva del hábito o del dx (F17 / Z72.0)",()=>{
  expect(derivePatientFactors([],null,{tabaquismo:true})).toContain("SMOKING");
  expect(derivePatientFactors(["F17.2"])).toContain("SMOKING");
  expect(derivePatientFactors(["Z72.0"])).toContain("SMOKING");
  expect(derivePatientFactors([],null,{tabaquismo:false})).not.toContain("SMOKING");
 });
});

describe("alcohol (hábito o F10) + fármaco hepatotóxico: la barrera avisa al prescribir (CAUTION anulable)",()=>{
 it("paracetamol con ALCOHOL -> CAUTION por hepatotoxicidad (glutatión/CYP2E1), no bloqueo",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"paracetamol-500",patientFactors:["ALCOHOL"]});
  expect(barrera(e,"interaction").status).toBe("CAUTION");
  expect(barrera(e,"interaction").detail).toMatch(/hepatotóxic|glutatión|CYP2E1|paracetamol/i);
  expect(e.verdict).not.toBe("BLOCK");
 });
 it("estatina con ALCOHOL -> CAUTION por hepatotoxicidad aditiva; sin el factor, pasa",()=>{
  const con=evaluatePrescriptionSafety({...base,drugCode:"atorvastatina-20",dose:"20mg",frequency:"QD",patientFactors:["ALCOHOL"]});
  expect(barrera(con,"interaction").status).toBe("CAUTION");
  const sin=evaluatePrescriptionSafety({...base,drugCode:"atorvastatina-20",dose:"20mg",frequency:"QD"});
  expect(barrera(sin,"interaction").status).toBe("PASSED");
 });
});

describe("tabaquismo (hábito o F17) como factor de barrera al prescribir",()=>{
 it("anticonceptivo combinado con SMOKING -> CAUTION (riesgo trombótico; contraindicado ≥35 años)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"etinilestradiol-30",dose:"1 tab",frequency:"QD",patientFactors:["SMOKING"]});
  expect(barrera(e,"interaction").status).toBe("CAUTION");
  expect(barrera(e,"interaction").detail).toMatch(/tromboemb|trombótic|≥35/i);
 });
 it("sustrato de CYP1A2 (teofilina) con SMOKING -> CAUTION (inducción enzimática); sin el factor, pasa",()=>{
  const con=evaluatePrescriptionSafety({...base,drugCode:"teofilina-300",dose:"300mg",frequency:"c/12h",patientFactors:["SMOKING"]});
  expect(barrera(con,"interaction").status).toBe("CAUTION");
  expect(barrera(con,"interaction").detail).toMatch(/CYP1A2|dejar de fumar|niveles/i);
  const sin=evaluatePrescriptionSafety({...base,drugCode:"teofilina-300",dose:"300mg",frequency:"c/12h"});
  expect(barrera(sin,"interaction").status).toBe("PASSED");
 });
});

describe("las reglas del embarazo y la lactancia por fin BLOQUEAN (R03-29)",()=>{
 it("IECA y ARA-II en el embarazo: contraindicados (fetotoxicidad)",()=>{
  for(const d of["enalapril-10","lisinopril-10","losartan-50"]){
   const e=evaluatePrescriptionSafety({...base,drugCode:d,dose:"10mg",frequency:"QD",patientFactors:["PREGNANCY"]});
   expect(barrera(e,"interaction").status,d).toBe("BLOCKED");
   expect(e.verdict,d).toBe("BLOCK");
   expect(barrera(e,"interaction").detail,d).toMatch(/Embarazo/);
  }
 });
 it("y las clases que faltaban: estatinas, sulfonamida antibiótica, fluoroquinolona, benzodiacepina",()=>{
  for(const d of["atorvastatina-20","sulfametoxazol-800","levofloxacino-500","clonazepam-2"]){
   const e=evaluatePrescriptionSafety({...base,drugCode:d,dose:"10mg",frequency:"QD",patientFactors:["PREGNANCY"]});
   expect(barrera(e,"interaction").status,d).toBe("BLOCKED");
  }
 });
 it("lactancia: tramadol y amiodarona contraindicados; paracetamol no",()=>{
  for(const d of["tramadol-50","amiodarona-200"]){
   const e=evaluatePrescriptionSafety({...base,drugCode:d,dose:"50mg",frequency:"QD",patientFactors:["LACTATION"]});
   expect(barrera(e,"interaction").status,d).toBe("BLOCKED");
   expect(barrera(e,"interaction").detail,d).toMatch(/Lactancia/);
  }
  expect(barrera(evaluatePrescriptionSafety({...base,patientFactors:["LACTATION"]}),"interaction").status).toBe("PASSED");
 });
 it("sin el factor, el mismo fármaco pasa: el bloqueo viene del expediente, no del fármaco",()=>{
  expect(barrera(evaluatePrescriptionSafety({...base,drugCode:"enalapril-10",dose:"10mg",frequency:"QD"}),"interaction").status).toBe("PASSED");
 });
 it("el bloqueo por factor es ANULABLE con justificación (es una decisión clínica, no un error de la orden)",()=>{
  // Dosis correcta de enalapril para que el único bloqueo sea el del factor (10 mg/día < 40 mg/día de techo).
  const e=evaluatePrescriptionSafety({...base,drugCode:"enalapril-10",dose:"10mg",frequency:"QD",patientFactors:["PREGNANCY"]});
  expect(e.blockedOverridable).toContain("interaction");
  expect(e.blockedHard).toEqual([]);
 });
});
