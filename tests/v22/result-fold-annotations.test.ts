import{describe,it,expect}from"vitest";
import{foldResult,RESULT_ANNOTATION_KINDS,RESULT_LIFECYCLE_KINDS}from"../../packages/result-fold/src";
// Va en su propio fichero porque tests/v22/result-fold.test.ts está fijado por sha256 en release/test-evidence-manifest.json
// (RG-013): una prueba nueva no reescribe la evidencia de otra.
const received=(critical:boolean)=>({sequence:1,payload:{kind:"RECEIVED",patientId:"p-1",orderId:"o-1",critical}});
const verified={sequence:2,payload:{kind:"VERIFIED"}};
const actioned={sequence:3,payload:{kind:"ACTIONED",patientId:"p-1",critical:true}};
const closed={sequence:4,payload:{kind:"CLOSED",evidence:"reviewed"}};

describe("anotaciones y ciclo de vida del resultado (SQL-2, porte)",()=>{
 // SQL-2 (porte): la proyección del registro toma el estado de RESULT_LIFECYCLE_KINDS e ignora exactamente estas anotaciones.
 // Main añadió la anulación (R03-10), así que la lista de anotaciones tiene dos elementos, no uno como en el origen.
 it("cada anotación declarada deja el estado intacto",()=>{
  expect([...RESULT_ANNOTATION_KINDS]).toEqual(["CORRECTED","ENTERED_IN_ERROR"]);
  for(const kind of RESULT_ANNOTATION_KINDS){
   const f=foldResult([received(true),verified,actioned,closed,{sequence:5,payload:{kind,supersededBy:"r-2",reason:"muestra de otro paciente"}}]);
   expect(f.state).toBe("CLOSED");expect(f.version).toBe(5);
   if(kind==="CORRECTED")expect(f.supersededBy).toBe("r-2");
   if(kind==="ENTERED_IN_ERROR")expect(f.enteredInError).toBe(true);
  }
 });
 it("ciclo de vida y anotaciones parten exactamente los kinds que acepta el fold",()=>{
  const all=[...RESULT_LIFECYCLE_KINDS,...RESULT_ANNOTATION_KINDS];
  expect(new Set(all).size).toBe(all.length);
  for(const kind of all)expect(()=>foldResult([received(false),{sequence:2,payload:{kind}}])).not.toThrow();
  expect(()=>foldResult([received(false),{sequence:2,payload:{kind:"AMENDED"}}])).toThrow(/Unknown result event/);
  expect([...RESULT_LIFECYCLE_KINDS]).toEqual(["RECEIVED","VERIFIED","ACTIONED","CLOSED"]);
 });
});
