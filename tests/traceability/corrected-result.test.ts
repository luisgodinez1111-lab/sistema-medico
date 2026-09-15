
import {describe,it,expect} from "vitest";
import {CorrectedResultDag} from "../../packages/clinical-kernel/src/corrected-result-dag";
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
