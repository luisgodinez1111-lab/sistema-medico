import { describe,it,expect } from "vitest";
import { requireComputed } from "../../packages/contracts/src/clinical-semantics";
describe("explicit computation semantics",()=>{
 it("never converts missing/unsupported to a normal value",()=>{
  expect(()=>requireComputed({status:"INSUFFICIENT_DATA",reason:"missing weight",provenance:[],version:"1"})).toThrow(/NOT_COMPUTED/);
 });
});
