import {describe,it,expect} from "vitest";
import {CorrectedResultDag} from "../../packages/result-correction/src";
// INV-CORE-0007 — contrato del linaje de corrección (diseño ejecutable; el evento RESULT_CORRECTED aún no existe: C-02).
describe("Corrected Result DAG",()=>{
 it("preserves immutable supersession lineage",()=>{
  const d=new CorrectedResultDag();
  d.add({id:"r1",version:1,hash:"h1",receivedAt:"2026-01-01"});
  d.add({id:"r2",version:2,supersedes:"r1",hash:"h2",receivedAt:"2026-01-02"});
  expect(d.lineage("r2").map(x=>x.id)).toEqual(["r2","r1"]);
 });
 it("rejects non-monotonic corrections",()=>{
  const d=new CorrectedResultDag(); d.add({id:"r1",version:2,hash:"h1",receivedAt:"2026-01-01"});
  expect(()=>d.add({id:"r2",version:2,supersedes:"r1",hash:"h2",receivedAt:"2026-01-02"})).toThrow(/NON_MONOTONIC/);
 });
});
import {foldResult,assertResultCorrectable} from "../../packages/result-fold/src";
// Auditoría C-02 (lote 10j): la corrección YA tiene ciclo de vida real: anotación CORRECTED (supersededBy) en el original y
// resultado nuevo con `supersedes`; el fold real enlaza ambos y una segunda corrección se rechaza.
describe("Corrected result — fold real (C-02)",()=>{
 it("el original queda supersedido sin cambiar de estado; el nuevo apunta al original; no se corrige dos veces",()=>{
  const orig=foldResult([{sequence:1,payload:{kind:"RECEIVED",patientId:"p",critical:true}},{sequence:2,payload:{kind:"CORRECTED",supersededBy:"r2",reason:"muestra hemolizada"}}]);
  expect(orig.state).toBe("RECEIVED");expect(orig.supersededBy).toBe("r2");
  expect(()=>assertResultCorrectable(orig)).toThrow(/already superseded/);
  const nuevo=foldResult([{sequence:1,payload:{kind:"RECEIVED",patientId:"p",critical:false,supersedes:"r1"}}]);
  expect(nuevo.supersedes).toBe("r1");expect(()=>assertResultCorrectable(nuevo)).not.toThrow();
 });
});
