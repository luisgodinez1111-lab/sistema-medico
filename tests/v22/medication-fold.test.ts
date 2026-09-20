import{describe,it,expect}from"vitest";
import{foldMedication,assertMedicationTransition,assertMedicationAnnotation}from"../../packages/medication-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";

const proposed={sequence:1,payload:{kind:"PROPOSED",patientId:"p-1",drugCode:"D",dose:"1",route:"PO",frequency:"QD"}};
const prescribed={sequence:2,payload:{kind:"PRESCRIBED",prescriberId:"dr-1"}};
const activated={sequence:3,payload:{kind:"ACTIVATED"}};
const stopped={sequence:4,payload:{kind:"STOPPED",reason:"adverse"}};

describe("medication fold (EPIC H)",()=>{
 it("empty -> not exists",()=>{expect(foldMedication([]).exists).toBe(false);});
 it("proposed -> PROPOSED v1 with patient",()=>{const f=foldMedication([proposed]);expect(f.state).toBe("PROPOSED");expect(f.version).toBe(1);expect(f.patientId).toBe("p-1");});
 it("through prescribe/activate/stop",()=>{
  expect(foldMedication([proposed,prescribed]).state).toBe("PRESCRIBED");
  expect(foldMedication([proposed,prescribed,activated]).state).toBe("ACTIVE");
  const f=foldMedication([proposed,prescribed,activated,stopped]);expect(f.state).toBe("STOPPED");expect(f.version).toBe(4);
 });
});

describe("medication transition guard (EPIC H)",()=>{
 it("allows the lifecycle path",()=>{
  expect(()=>assertMedicationTransition("PROPOSED","PRESCRIBED")).not.toThrow();
  expect(()=>assertMedicationTransition("PRESCRIBED","ACTIVE")).not.toThrow();
  expect(()=>assertMedicationTransition("ACTIVE","STOPPED")).not.toThrow();
  expect(()=>assertMedicationTransition("ACTIVE","HELD")).not.toThrow();
  expect(()=>assertMedicationTransition("HELD","ACTIVE")).not.toThrow();
 });
 it("blocks skipping prescription (PROPOSED -> ACTIVE)",()=>{
  const err=(()=>{try{assertMedicationTransition("PROPOSED","ACTIVE");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
 });
 it("blocks mutating a STOPPED medication",()=>{expect(()=>assertMedicationTransition("STOPPED","ACTIVE")).toThrow();});
});
// Auditoría 2026-09-19 (L-04) — MODIFY y RECONCILE son ANOTACIONES: antes pedían la "transición" ACTIVE->ACTIVE (siempre 409)
// y un evento MODIFIED guardado habría hecho fallar el fold con INVARIANT_VIOLATION (medicación ilegible para siempre).
describe("medication fold — eventos de anotación (auditoría L-04)",()=>{
 const modified={sequence:4,payload:{kind:"MODIFIED",dose:"2",frequency:"BID",reason:"ajuste por respuesta"}};
 const reconciled={sequence:5,payload:{kind:"RECONCILED",reconciliationStatus:"UNCHANGED"}};
 it("MODIFIED no cambia el estado, sube la versión y actualiza SOLO los campos provistos",()=>{
  const f=foldMedication([proposed,prescribed,activated,modified]);
  expect(f.state).toBe("ACTIVE");expect(f.version).toBe(4);
  expect(f).toMatchObject({dose:"2",frequency:"BID",route:"PO"}); // la vía no se envió: se conserva
 });
 it("RECONCILED no cambia el estado ni la orden",()=>{
  const f=foldMedication([proposed,prescribed,activated,modified,reconciled]);
  expect(f.state).toBe("ACTIVE");expect(f.version).toBe(5);expect(f.dose).toBe("2");
 });
 it("una anotación tras HELD conserva HELD; un STOP posterior sigue siendo terminal",()=>{
  const held={sequence:4,payload:{kind:"HELD",reason:"cirugía"}};
  expect(foldMedication([proposed,prescribed,activated,held,{...modified,sequence:5}]).state).toBe("HELD");
  expect(foldMedication([proposed,prescribed,activated,modified,{sequence:5,payload:{kind:"STOPPED",reason:"fin"}}]).state).toBe("STOPPED");
 });
 it("campos vacíos en MODIFIED no borran la orden vigente",()=>{
  expect(foldMedication([proposed,prescribed,activated,{sequence:4,payload:{kind:"MODIFIED",dose:"  ",reason:"x"}}]).dose).toBe("1");
 });
 it("solo se anota una medicación EN CURSO (ACTIVE/HELD)",()=>{
  expect(()=>assertMedicationAnnotation("ACTIVE","MODIFIED")).not.toThrow();
  expect(()=>assertMedicationAnnotation("HELD","RECONCILED")).not.toThrow();
  for(const s of["PROPOSED","PRESCRIBED","STOPPED"]as const)expect(()=>assertMedicationAnnotation(s,"MODIFIED")).toThrow(ClinicalError);
 });
 it("un kind realmente desconocido sigue siendo INVARIANT_VIOLATION (no se traga basura)",()=>{
  expect(()=>foldMedication([proposed,{sequence:2,payload:{kind:"TELETRANSPORTED"}}])).toThrow(ClinicalError);
 });
});
