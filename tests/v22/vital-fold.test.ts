import{describe,it,expect}from"vitest";
import{foldVital,assertVitalTransition,VITAL_VOID_KIND}from"../../packages/vital-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
const rec={sequence:1,payload:{kind:"RECORDED",patientId:"p1",vitalType:"BP",value:"120/80",unit:"mmHg"}};
describe("vital fold (EPIC W)",()=>{
 it("empty -> not exists",()=>{expect(foldVital([]).exists).toBe(false);});
 it("recorded -> RECORDED v1 with value",()=>{const f=foldVital([rec]);expect(f.state).toBe("RECORDED");expect(f.vitalType).toBe("BP");expect(f.value).toBe("120/80");expect(f.unit).toBe("mmHg");});
 it("amend updates the current value (append-only)",()=>{const f=foldVital([rec,{sequence:2,payload:{kind:"AMENDED",value:"130/85",unit:"mmHg",reason:"typo"}}]);expect(f.state).toBe("AMENDED");expect(f.value).toBe("130/85");});
 it("re-amend keeps latest value",()=>{const f=foldVital([rec,{sequence:2,payload:{kind:"AMENDED",value:"130/85",unit:"mmHg"}},{sequence:3,payload:{kind:"AMENDED",value:"128/82",unit:"mmHg"}}]);expect(f.state).toBe("AMENDED");expect(f.value).toBe("128/82");});
 it("entered in error is terminal",()=>{expect(foldVital([rec,{sequence:2,payload:{kind:"ENTERED_IN_ERROR"}}]).state).toBe("ENTERED_IN_ERROR");});
});
describe("vital transition guard (EPIC W)",()=>{
 it("allows RECORDED/AMENDED -> {AMENDED, ENTERED_IN_ERROR}",()=>{
  expect(()=>assertVitalTransition("RECORDED","AMENDED")).not.toThrow();
  expect(()=>assertVitalTransition("RECORDED","ENTERED_IN_ERROR")).not.toThrow();
  expect(()=>assertVitalTransition("AMENDED","AMENDED")).not.toThrow();
  expect(()=>assertVitalTransition("AMENDED","ENTERED_IN_ERROR")).not.toThrow();
 });
 it("blocks mutating a terminal ENTERED_IN_ERROR",()=>{
  const err=(()=>{try{assertVitalTransition("ENTERED_IN_ERROR","AMENDED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
 });
});
// Hallazgo D1 (porte a main): los read models SQL (`vitalVigente`/`vitalNoAnulada` en apps/web/lib/runtime/read-model-joins.ts) proyectan
// las dos reglas del fold con su mismo vocabulario; si el fold cambia, estas pruebas obligan a revisar la proyección.
describe("vocabulario compartido con los read models SQL (D1)",()=>{
 it("VITAL_VOID_KIND es el ÚNICO evento que deja la observación terminal (la proyección la excluye)",()=>{
  for(const k of ["RECORDED","AMENDED","ENTERED_IN_ERROR"] as const){
   const f=foldVital(k==="RECORDED"?[rec]:[rec,{sequence:2,payload:{kind:k,...(k==="AMENDED"?{value:"1",unit:"u"}:{})}}]);
   const terminal=(["AMENDED","ENTERED_IN_ERROR"] as const).every(to=>{try{assertVitalTransition(f.state,to);return false;}catch{return true;}});
   expect(terminal).toBe(k===VITAL_VOID_KIND);
  }
 });
 it("el valor vigente es el del último evento que lo aporta (la proyección: último evento con `payload ? 'value'`)",()=>{
  const f=foldVital([{...rec,payload:{...rec.payload,vitalType:"WEIGHT",value:"70",unit:"kg"}},{sequence:2,payload:{kind:"AMENDED",value:"7",unit:"kg"}},{sequence:3,payload:{kind:"AMENDED",reason:"sin valor"}}]);
  expect(f.value).toBe("7");expect(f.unit).toBe("kg");
 });
});
