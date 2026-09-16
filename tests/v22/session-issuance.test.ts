import{describe,it,expect}from"vitest";
import{scopesForRoles}from"../../packages/session-issuance/src";
// CAP-AUTHZ-001 — RBAC: los scopes clínicos se derivan de los roles (unión), no del token de identidad.
describe("scopesForRoles (RBAC, CAP-AUTHZ-001)",()=>{
 it("un PHYSICIAN obtiene los scopes clínicos del bucle central",()=>{
  const s=scopesForRoles(["PHYSICIAN"]);
  expect(s).toContain("encounter:write");
  expect(s).toContain("medication:write");
  expect(s).toContain("patient:read");
 });
 it("hace la UNIÓN de scopes de múltiples roles, sin duplicar",()=>{
  const s=scopesForRoles(["PHYSICIAN","CLINICAL_ADMIN"]);
  expect(s).toContain("billing:write");        // de PHYSICIAN/CLINICAL_ADMIN
  expect(new Set(s).size).toBe(s.length);       // sin duplicados
 });
 it("un rol desconocido no aporta scopes",()=>{
  expect(scopesForRoles(["GHOST_ROLE"])).toEqual([]);
 });
});
