import{describe,it,expect}from"vitest";
import{foldPatient,assertPatientTransition,patientDemographicsOf,PATIENT_DEMOGRAPHIC_FIELDS}from"../../packages/patient-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const reg={sequence:1,payload:{kind:"REGISTERED",name:"Juan Pérez",birthDate:"1980-05-05",sexAtBirth:"MALE"}};
describe("patient fold (EPIC S)",()=>{
 it("empty -> not exists",()=>{expect(foldPatient([]).exists).toBe(false);});
 it("registered -> ACTIVE v1 with demographics",()=>{const f=foldPatient([reg]);expect(f.status).toBe("ACTIVE");expect(f.name).toBe("Juan Pérez");expect(f.sexAtBirth).toBe("MALE");});
 it("deactivate then reactivate",()=>{expect(foldPatient([reg,{sequence:2,payload:{kind:"DEACTIVATED"}}]).status).toBe("INACTIVE");expect(foldPatient([reg,{sequence:2,payload:{kind:"DEACTIVATED"}},{sequence:3,payload:{kind:"REACTIVATED"}}]).status).toBe("ACTIVE");});
});
describe("patient transition guard (EPIC S)",()=>{
 it("allows ACTIVE<->INACTIVE and ->DECEASED",()=>{expect(()=>assertPatientTransition("ACTIVE","INACTIVE")).not.toThrow();expect(()=>assertPatientTransition("INACTIVE","ACTIVE")).not.toThrow();expect(()=>assertPatientTransition("ACTIVE","DECEASED")).not.toThrow();});
 it("blocks mutating a DECEASED patient (terminal)",()=>{const err=(()=>{try{assertPatientTransition("DECEASED","ACTIVE");}catch(e){return e;}})();expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");});
});
// Lote 11, hallazgo D2: la demografía vigente es campo a campo (el último evento que TRAE cada campo). La proyección SQL
// (`patientDemographicsJoin` en apps/web/lib/runtime/sql.ts) replica esta regla con el mismo vocabulario.
describe("demografía vigente campo a campo (lote 11, D2)",()=>{
 const amendments=[reg,{sequence:2,payload:{kind:"AMENDED",name:"Juan P. Gómez",birthDate:"2020-05-05",guardian:{name:"Tutor",relationship:"Madre"}}},
  {sequence:3,payload:{kind:"DEACTIVATED"}},{sequence:4,payload:{kind:"AMENDED",phone:"5559999999"}}];
 it("una enmienda posterior de OTRO campo no revierte las anteriores",()=>{
  const d=patientDemographicsOf(amendments);
  expect(d).toEqual({name:"Juan P. Gómez",birthDate:"2020-05-05",sexAtBirth:"MALE",guardian:{name:"Tutor",relationship:"Madre"},phone:"5559999999"});
 });
 it("el fold expone exactamente la misma demografía y el estado no lo cambian las enmiendas",()=>{
  const f=foldPatient(amendments);
  expect([f.name,f.birthDate,f.sexAtBirth,f.status]).toEqual(["Juan P. Gómez","2020-05-05","MALE","INACTIVE"]);
 });
 it("solo proyecta los campos del vocabulario y solo de altas y enmiendas",()=>{
  const d=patientDemographicsOf([reg,{sequence:2,payload:{kind:"DECEASED",name:"no es demografía"}},{sequence:3,payload:{kind:"AMENDED",confirmedNotDuplicate:true}}]);
  expect(Object.keys(d).every(k=>(PATIENT_DEMOGRAPHIC_FIELDS as readonly string[]).includes(k))).toBe(true);
  expect(d.name).toBe("Juan Pérez");
 });
});
