import{describe,it,expect}from"vitest";
import{foldResult,assertResultTransition}from"../../packages/result-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";

const received=(critical:boolean)=>({sequence:1,payload:{kind:"RECEIVED",patientId:"p-1",orderId:"o-1",critical}});
const verified={sequence:2,payload:{kind:"VERIFIED"}};
const actioned={sequence:3,payload:{kind:"ACTIONED",patientId:"p-1",critical:true}};
const closed={sequence:4,payload:{kind:"CLOSED",evidence:"reviewed"}};

describe("result fold (EPIC G)",()=>{
 it("empty -> not exists",()=>{expect(foldResult([]).exists).toBe(false);});
 it("received(critical) -> RECEIVED v1",()=>{const f=foldResult([received(true)]);expect(f.state).toBe("RECEIVED");expect(f.version).toBe(1);expect(f.patientId).toBe("p-1");expect(f.critical).toBe(true);});
 it("received+verified -> VERIFIED v2",()=>{expect(foldResult([received(false),verified]).state).toBe("VERIFIED");});
 it("through actioned -> ACTIONED v3, keeps critical",()=>{const f=foldResult([received(true),verified,actioned]);expect(f.state).toBe("ACTIONED");expect(f.version).toBe(3);expect(f.critical).toBe(true);});
 it("closed -> CLOSED v4",()=>{expect(foldResult([received(true),verified,actioned,closed]).state).toBe("CLOSED");});
});

describe("result transition guard (EPIC G)",()=>{
 it("allows the closed-loop path",()=>{
  expect(()=>assertResultTransition("RECEIVED","VERIFIED")).not.toThrow();
  expect(()=>assertResultTransition("VERIFIED","ACTIONED")).not.toThrow();
  expect(()=>assertResultTransition("ACTIONED","CLOSED")).not.toThrow();
 });
 it("blocks skipping verification (RECEIVED -> CLOSED)",()=>{
  const err=(()=>{try{assertResultTransition("RECEIVED","CLOSED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
 });
 it("blocks re-closing a CLOSED result",()=>{expect(()=>assertResultTransition("CLOSED","CLOSED")).toThrow();});
});
