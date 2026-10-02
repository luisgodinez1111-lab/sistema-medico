import{describe,it,expect}from"vitest";
import{foldResult,RESULT_ANNOTATION_KINDS,RESULT_LIFECYCLE_KINDS,RESULT_EVENT_KINDS,RESULT_FOLLOW_UP_CLOSING_KINDS,resultAwaitsFollowUp,type ResultEventKind}from"../../packages/result-fold/src";
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
  // Revisión del porte (d424bdc): EXHAUSTIVIDAD, no solo ausencia de duplicados. Los kinds que acepta el fold son
  // exactamente la unión de las dos listas, en tipos (un kind de ResultEventKind fuera de ambas no compila: `pnpm typecheck`
  // incluye tests/) y en ejecución (RESULT_EVENT_KINDS es lo que reconoce `kindOf`).
  type Particion=typeof RESULT_LIFECYCLE_KINDS[number]|typeof RESULT_ANNOTATION_KINDS[number];
  type Igual<A,B>=[A] extends [B]?([B] extends [A]?true:false):false;
  const particionExacta:Igual<ResultEventKind,Particion>=true;
  expect(particionExacta).toBe(true);
  expect([...RESULT_EVENT_KINDS].sort()).toEqual([...all].sort());
 });
});

// Porte D5 (REV-C): una sola regla decide si un resultado sigue esperando seguimiento — el gate de firma (SQL) y el derivado
// del replay (la obligación urgente de un crítico no se reabre si su seguimiento ya terminó).
describe("resultAwaitsFollowUp (porte D5)",()=>{
 const corrected={sequence:2,payload:{kind:"CORRECTED",supersededBy:"r-2",reason:"hemólisis"}};
 const voided={sequence:2,payload:{kind:"ENTERED_IN_ERROR",reason:"paciente equivocado"}};
 it("un resultado abierto (RECEIVED, VERIFIED, ACTIONED) espera seguimiento",()=>{
  expect(resultAwaitsFollowUp(foldResult([received(true)]))).toBe(true);
  expect(resultAwaitsFollowUp(foldResult([received(true),verified]))).toBe(true);
  expect(resultAwaitsFollowUp(foldResult([received(true),verified,actioned]))).toBe(true);
 });
 it("CLOSED, CORRECTED y ENTERED_IN_ERROR terminan el seguimiento; un resultado inexistente no lo espera",()=>{
  expect(resultAwaitsFollowUp(foldResult([received(true),verified,actioned,closed]))).toBe(false);
  expect(resultAwaitsFollowUp(foldResult([received(true),corrected]))).toBe(false);
  expect(resultAwaitsFollowUp(foldResult([received(true),voided]))).toBe(false);
  expect(resultAwaitsFollowUp(foldResult([]))).toBe(false);
 });
 it("la lista SQL y el predicado son la misma regla: cada tipo de la lista, añadido a un resultado abierto, lo termina",()=>{
  expect([...RESULT_FOLLOW_UP_CLOSING_KINDS].sort()).toEqual(["CLOSED","CORRECTED","ENTERED_IN_ERROR"]);
  for(const kind of RESULT_FOLLOW_UP_CLOSING_KINDS){
   const ev={sequence:4,payload:{kind,supersededBy:"r-2",reason:"x",evidence:"x"}};
   expect(resultAwaitsFollowUp(foldResult([received(true),verified,actioned,ev])),kind).toBe(false);
  }
 });
});
