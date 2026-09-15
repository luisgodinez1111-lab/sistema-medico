
import {describe,it,expect} from "vitest";
import {replay,patientImpact} from "../../packages/clinical-kernel/src/replay-impact";
const events=[
 {id:"e1",patientId:"p1",occurredAt:"2026-01-01",authority:"ENG-312",artifactVersion:"v1",payload:{}},
 {id:"e2",patientId:"p2",occurredAt:"2026-01-03",authority:"ENG-313",artifactVersion:"v2",payload:{}}
];
describe("Replay + Patient Impact",()=>{
 it("reconstructs as-of state",()=>expect(replay(events,"2026-01-02").map(x=>x.id)).toEqual(["e1"]));
 it("finds affected patients by version",()=>expect(patientImpact(events,"v1").patients).toEqual(["p1"]));
});
