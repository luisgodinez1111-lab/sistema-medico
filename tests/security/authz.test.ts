import {describe,it,expect} from "vitest";
import {authorize} from "../../packages/runtime-auth/src";
// Auditoría 2026-09-19 (S-09): la ÚNICA autorización es packages/runtime-auth (ClinicalError con código); packages/authz se retiró.
const p={actorId:"u",tenantId:"a",roles:["PHYSICIAN"],scopes:["patient:read"],purpose:"TREATMENT",sessionId:"s"};
describe("authz (runtime-auth)",()=>{
 it("blocks cross tenant",()=>expect(()=>authorize(p,{tenantId:"b",scope:"patient:read"})).toThrow(/Cross-tenant/));
 it("fails closed without a scope and without a session",()=>{
  expect(()=>authorize(p,{tenantId:"a",scope:""})).toThrow(/requires a scope/);
  expect(()=>authorize({...p,sessionId:""},{tenantId:"a",scope:"patient:read"})).toThrow(/session/);
 });
 it("write implies read, never the reverse",()=>{
  expect(()=>authorize({...p,scopes:["patient:write"]},{tenantId:"a",scope:"patient:read"})).not.toThrow();
  expect(()=>authorize(p,{tenantId:"a",scope:"patient:write"})).toThrow(/scope/);
 });
});
