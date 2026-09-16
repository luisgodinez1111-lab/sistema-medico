import{describe,it,expect}from"vitest";
import{foldOrder,assertOrderTransition}from"../../packages/order-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";

const created={sequence:1,payload:{kind:"CREATED",patientId:"p-1",orderType:"LAB",detail:"Hemograma"}};
const placed={sequence:2,payload:{kind:"PLACED"}};
const fulfilled={sequence:3,payload:{kind:"FULFILLED"}};

describe("order fold (EPIC M)",()=>{
 it("empty -> not exists",()=>{expect(foldOrder([]).exists).toBe(false);});
 it("created -> DRAFT v1 with patient/type",()=>{const f=foldOrder([created]);expect(f.state).toBe("DRAFT");expect(f.version).toBe(1);expect(f.patientId).toBe("p-1");expect(f.orderType).toBe("LAB");});
 it("through placed/fulfilled",()=>{expect(foldOrder([created,placed]).state).toBe("ORDERED");expect(foldOrder([created,placed,fulfilled]).state).toBe("FULFILLED");});
 it("cancel from draft",()=>{expect(foldOrder([created,{sequence:2,payload:{kind:"CANCELLED",reason:"x"}}]).state).toBe("CANCELLED");});
});
describe("order transition guard (EPIC M)",()=>{
 it("allows the lifecycle",()=>{expect(()=>assertOrderTransition("DRAFT","ORDERED")).not.toThrow();expect(()=>assertOrderTransition("ORDERED","FULFILLED")).not.toThrow();expect(()=>assertOrderTransition("DRAFT","CANCELLED")).not.toThrow();expect(()=>assertOrderTransition("ORDERED","CANCELLED")).not.toThrow();});
 it("blocks fulfilling a draft (must place first)",()=>{const err=(()=>{try{assertOrderTransition("DRAFT","FULFILLED");}catch(e){return e;}})();expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");});
 it("blocks mutating a fulfilled order",()=>{expect(()=>assertOrderTransition("FULFILLED","CANCELLED")).toThrow();});
});
