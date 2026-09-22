import{describe,it,expect}from"vitest";
import{authorize,hasScope,effectiveScopes,type Principal}from"../../packages/runtime-auth/src";
import{scopesForRoles}from"../../packages/session-issuance/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
// Auditoría 2026-09-19 (S-01, S-02) — scope obligatorio; escritura implica lectura; lectura NUNCA implica escritura.
const P=(scopes:string[],roles=["PHYSICIAN"]):Principal=>({tenantId:"t",actorId:"u",roles,scopes,purpose:"TREATMENT",sessionId:"s"});
describe("hasScope — jerarquía",()=>{
 it("write => read y propose => read, solo para el MISMO recurso",()=>{
  expect(hasScope(["order:write"],"order:read")).toBe(true);
  expect(hasScope(["medication:propose"],"medication:read")).toBe(true);
  expect(hasScope(["order:write"],"result:read")).toBe(false);
  expect(hasScope(["order:write"],"order:write")).toBe(true);
 });
 it("read no implica write ni propose; export no implica nada",()=>{
  expect(hasScope(["order:read"],"order:write")).toBe(false);
  expect(hasScope(["medication:read"],"medication:propose")).toBe(false);
  expect(hasScope(["record:export"],"patient:read")).toBe(false);
 });
 it("no hay coincidencias por prefijo ni por cadenas malformadas",()=>{
  expect(hasScope(["orders:write"],"order:read")).toBe(false);
  expect(hasScope(["order"],"order:read")).toBe(false);
  expect(hasScope(["order:write"],"order")).toBe(false);
  expect(hasScope([":write"],":read")).toBe(false);
 });
 it("effectiveScopes lista los implicados (para mostrar permisos), ordenados y sin duplicados",()=>{
  expect(effectiveScopes(["order:write","order:read","medication:propose"])).toEqual(["medication:propose","medication:read","order:read","order:write"]);
 });
});
describe("authorize",()=>{
 it("sin scope no autoriza: un llamador mal escrito falla cerrado (INVARIANT_VIOLATION), nunca abierto",()=>{
  expect(()=>authorize(P(["patient:read"]),{tenantId:"t",scope:""} )).toThrow(ClinicalError);
  try{authorize(P(["patient:read"]),{tenantId:"t",scope:""});}catch(e){expect((e as ClinicalError).code).toBe("INVARIANT_VIOLATION");}
 });
 it("una sesión con scope de escritura puede LEER (compatibilidad con las sesiones ya emitidas)",()=>{
  expect(authorize(P(["result:write"]),{tenantId:"t",scope:"result:read",purpose:"TREATMENT"})).toBe(true);
 });
 it("una sesión de solo lectura NO puede escribir",()=>{
  expect(()=>authorize(P(["result:read"],["AUDITOR"]),{tenantId:"t",scope:"result:write",purpose:"TREATMENT"})).toThrow(/scope/);
 });
 it("tenant, rol y propósito siguen mandando",()=>{
  expect(()=>authorize(P(["result:write"]),{tenantId:"otro",scope:"result:read"})).toThrow(/Cross-tenant/);
  expect(()=>authorize(P(["result:write"],["NURSE"]),{tenantId:"t",role:"PHYSICIAN",scope:"result:read"})).toThrow(/role/);
  expect(()=>authorize(P(["result:write"]),{tenantId:"t",scope:"result:read",purpose:"BILLING"})).toThrow(/Purpose/);
  expect(()=>authorize({...P(["result:write"]),sessionId:""},{tenantId:"t",scope:"result:read"})).toThrow(/session/);
 });
});
describe("política rol -> scopes",()=>{
 it("AUDITOR solo tiene lecturas: puede leer todo lo clínico y no puede escribir nada",()=>{
  const s=scopesForRoles(["AUDITOR"]);
  expect(s.length).toBeGreaterThan(10);expect(s.every(x=>x.endsWith(":read"))).toBe(true);
  for(const r of["patient","result","order","medication","document","problem","allergy"])expect(hasScope(s,`${r}:read`),r).toBe(true);
  for(const w of["result:write","medication:propose","document:write","patient:write","record:export"])expect(hasScope(s,w),w).toBe(false);
 });
 it("PHYSICIAN y NURSE conservan sus escrituras y, por implicación, todas las lecturas que ya usaban",()=>{
  for(const role of["PHYSICIAN","NURSE"]){const s=scopesForRoles([role]);
   for(const r of["allergy:read","problem:read","obligation:read","document:read","immunization:read","careplan:read"])expect(hasScope(s,r),`${role} ${r}`).toBe(true);}
  expect(hasScope(scopesForRoles(["NURSE"]),"result:write")).toBe(false);
  expect(hasScope(scopesForRoles(["NURSE"]),"result:read")).toBe(false); // enfermería no tenía acceso a resultados: no se amplía en silencio
 });
});
