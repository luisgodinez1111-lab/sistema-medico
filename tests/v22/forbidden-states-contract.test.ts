import{describe,it,expect}from"vitest";
import{forbiddenStates as runtime,assertNoForbidden}from"../../packages/design-system/src";
import{forbiddenStates as contract}from"../../docs/design-contract/contracts/forbidden-states";
// Auditoría 2026-09-19 (G-09): el guardián de runtime lleva TODOS los pares del contrato de diseño, no un subconjunto.
describe("contrato de estados prohibidos (G-09)",()=>{
 it("runtime y contrato declaran exactamente los mismos 20 pares",()=>{
  expect([...runtime].sort()).toEqual([...contract].sort());expect(runtime.length).toBe(20);
 });
 it("los pares de mayor riesgo se detectan",()=>{
  const pairs:[string,string][]=[["TENANT_INVALID","PHI_INTERACTIVE"],["UNAUTHORIZED","MUTATION_ENABLED"],["SIGNED","EDITABLE_AUTHORITATIVE"],["STALE_AI","AUTO_APPLY_ENABLED"],["BREAK_GLASS_EXPIRED","ACCESS_ACTIVE"]];
  for(const[a,b]of pairs)
   expect(()=>assertNoForbidden([a,b])).toThrow(`FORBIDDEN_STATE:${a}+${b}`);
  expect(()=>assertNoForbidden(["SIGNED","PHI_INTERACTIVE","MUTATION_ENABLED"])).not.toThrow();
 });
});
