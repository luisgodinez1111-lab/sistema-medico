import{describe,it,expect}from"vitest";
import{SLI_CATALOG,assertSliPhiFree,tenantHash,sliSpan,onSli,flowForTopic,type SliEvent}from"../../packages/observability/src";
// EPIC BG (endurecimiento G / ENG-054) — Observabilidad SLI con garantía PHI-free.
describe("observabilidad SLI (ENG-054)",()=>{
 it("el catálogo cubre los 8 flujos de ENG-054",()=>{
  expect(Object.keys(SLI_CATALOG).sort()).toEqual(["auth","autosave","critical_alert","patient_open","result_ingest","share","sign","workflow"]);
 });
 it("assertSliPhiFree acepta el evento allowlisted y RECHAZA cualquier campo extra (posible PHI)",()=>{
  const ok:SliEvent={flow:"sign",sli:"commit",outcome:"success",latencyMs:5,correlationId:"c1",traceId:"t1",at:"2026-09-17T00:00:00.000Z"};
  expect(()=>assertSliPhiFree(ok as unknown as Record<string,unknown>)).not.toThrow();
  expect(()=>assertSliPhiFree({...ok,patientId:"p-123"} as unknown as Record<string,unknown>)).toThrow(/no permitido/);
  expect(()=>assertSliPhiFree({...ok,name:"Juan"} as unknown as Record<string,unknown>)).toThrow();
  expect(()=>assertSliPhiFree({...ok,diagnosis:"E11"} as unknown as Record<string,unknown>)).toThrow();
 });
 it("tenantHash no revela el id crudo (hash corto determinista)",()=>{
  const t="11111111-1111-4111-8111-111111111111";
  expect(tenantHash(t)).toHaveLength(12);
  expect(tenantHash(t)).not.toContain("1111-1111");
  expect(tenantHash(t)).toBe(tenantHash(t));
 });
 it("sliSpan emite un evento PHI-free con latencia, correlación y tenant hasheado",()=>{
  const seen:SliEvent[]=[];const off=onSli(e=>seen.push(e));
  try{
   const span=sliSpan("sign","commit","corr-9");
   const e=span.end("success",{tenantId:"tenant-abc"});
   expect(seen).toHaveLength(1);
   expect(e).toMatchObject({flow:"sign",sli:"commit",outcome:"success",correlationId:"corr-9"});
   expect(e.latencyMs).toBeGreaterThanOrEqual(0);
   expect(e.tenantHash).toBe(tenantHash("tenant-abc"));
   expect((e as Record<string,unknown>)["tenantId"]).toBeUndefined(); // nunca el id crudo
   expect(()=>assertSliPhiFree(e as unknown as Record<string,unknown>)).not.toThrow();
  }finally{off();}
 });
 it("el path de error lleva el código, sin PHI",()=>{
  const seen:SliEvent[]=[];const off=onSli(e=>seen.push(e));
  try{sliSpan("autosave","commit","corr-e").end("error",{code:"CONFLICT",tenantId:"t"});
   expect(seen[0]).toMatchObject({outcome:"error",code:"CONFLICT"});
  }finally{off();}
 });
 it("flowForTopic mapea a los flujos ENG-054",()=>{
  expect(flowForTopic("encounter.signed")).toBe("sign");
  expect(flowForTopic("result.received")).toBe("result_ingest");
  expect(flowForTopic("obligation.created")).toBe("workflow");
  expect(flowForTopic("medication.proposed")).toBe("autosave");
 });
});
