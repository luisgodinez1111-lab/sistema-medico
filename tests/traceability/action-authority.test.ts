
import {describe,it,expect} from "vitest";
import {authorizeClinicalAction} from "../../packages/clinical-safety/src/action-authority";
describe("Clinical action authority",()=>{
 it("blocks AI prescription",()=>expect(()=>authorizeClinicalAction("AI","PRESCRIBE")).toThrow(/PHYSICIAN_AUTHORITY/));
 it("blocks AI closing critical workflow",()=>expect(()=>authorizeClinicalAction("AI","CLOSE_CRITICAL")).toThrow(/AI_IRREVERSIBLE/));
 it("permits physician signing",()=>expect(authorizeClinicalAction("PHYSICIAN","SIGN")).toBe(true));
});
