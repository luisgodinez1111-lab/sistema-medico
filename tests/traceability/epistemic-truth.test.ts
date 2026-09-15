
import {describe,it,expect} from "vitest";
import {promoteTruth} from "../../packages/clinical-kernel/src/epistemic-truth";
describe("Clinical Truthfulness",()=>{
 it("blocks AI from deciding",()=>expect(()=>promoteTruth("RECOMMENDED","DECIDED","AI")).toThrow(/HUMAN_AUTHORITY_REQUIRED/));
 it("blocks inference from becoming verified silently",()=>expect(()=>promoteTruth("INFERRED","VERIFIED","SYSTEM")).toThrow(/ILLEGAL_EPISTEMIC_PROMOTION/));
});
