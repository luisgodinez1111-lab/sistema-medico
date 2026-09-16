import{describe,it,expect}from"vitest";
import{buildRecordManifest,canonicalManifest}from"../../packages/record-export/src";
const R=(aggregateId:string,aggregateType:string,sequence:number,kind:string,occurredAt:string)=>({aggregateId,aggregateType,sequence,kind,occurredAt});
const rows=[
 R("agg-B","Referral",1,"REQUESTED","2026-01-02T00:00:00.000Z"),
 R("agg-B","Referral",2,"ACCEPTED","2026-01-03T00:00:00.000Z"),
 R("agg-A","Encounter",2,"SIGNED","2026-01-01T10:00:00.000Z"),
 R("agg-A","Encounter",1,"OPENED","2026-01-01T09:00:00.000Z"),
];
describe("record export manifest (EPIC AB)",()=>{
 it("vacío -> manifiesto en cero",()=>{const m=buildRecordManifest("p1",[]);expect(m.aggregateCount).toBe(0);expect(m.eventCount).toBe(0);});
 it("agrupa por agregado, ordena eventos por secuencia y agregados por id",()=>{
  const m=buildRecordManifest("p1",rows);
  expect(m.aggregateCount).toBe(2);expect(m.eventCount).toBe(4);
  expect(m.aggregates[0]!.aggregateId).toBe("agg-A");
  expect(m.aggregates[0]!.events.map(e=>e.sequence)).toEqual([1,2]);
  expect(m.aggregates[0]!.latestKind).toBe("SIGNED");
  expect(m.aggregates[1]!.latestKind).toBe("ACCEPTED");
 });
 it("canonicalManifest es determinista e independiente del orden de lectura",()=>{
  const a=canonicalManifest(buildRecordManifest("p1",rows));
  const b=canonicalManifest(buildRecordManifest("p1",[...rows].reverse()));
  expect(a).toBe(b);
 });
 it("un cambio en el expediente cambia la serialización (tamper-evidencia)",()=>{
  const base=canonicalManifest(buildRecordManifest("p1",rows));
  const tampered=canonicalManifest(buildRecordManifest("p1",[...rows,R("agg-A","Encounter",3,"AMENDED","2026-01-01T11:00:00.000Z")]));
  expect(tampered).not.toBe(base);
 });
});
