import{describe,it,expect}from"vitest";
import fs from "node:fs";
import path from "node:path";
import{authorize,assertResourceInTenant,patientAccessPolicy,type Principal}from"../../packages/runtime-auth/src";
import{runtimeSource}from"./_runtime-src";
// Auditoría 2026-09-19, anexo R01 (R01-003, R01-019) — el chequeo cross-tenant de `authorize()` era TAUTOLÓGICO: las 97
// llamadas pasaban `tenantId: claims.tenantId`, o sea comparaban el tenant del principal consigo mismo. Ningún test lo
// cubría (nadie podía: no podía fallar). Estas pruebas fijan el modelo nuevo y la política de acceso vigente.
const P=(over:Partial<Principal>={}):Principal=>({
 tenantId:"11111111-1111-4111-8111-111111111111",actorId:"22222222-2222-4222-8222-222222222222",
 roles:["PHYSICIAN"],scopes:["patient:write","encounter:write"],purpose:"TREATMENT",
 sessionId:"33333333-3333-4333-8333-333333333333",...over});
const OTRO_TENANT="99999999-9999-4999-8999-999999999999";

describe("authorize con recurso explícito (R01-019)",()=>{
 it("autoriza con el scope mínimo y el propósito declarado",()=>{
  expect(authorize(P(),{scope:"patient:read",purpose:"TREATMENT"})).toBe(true);
 });
 it("el chequeo cross-tenant AHORA puede fallar: un recurso de otro tenant se rechaza",()=>{
  expect(()=>authorize(P(),{scope:"patient:read",resource:{type:"Patient",id:"44444444-4444-4444-8444-444444444444",tenantId:OTRO_TENANT}}))
   .toThrow(/Cross-tenant/);
 });
 it("el error de cross-tenant nombra el TIPO del recurso, nunca su contenido",()=>{
  const err=(()=>{try{authorize(P(),{scope:"patient:read",resource:{type:"ClinicalDocument",id:"44444444-4444-4444-8444-444444444444",tenantId:OTRO_TENANT}});}catch(e){return e as{code:string;details?:Record<string,unknown>};}return undefined;})();
  expect(err?.code).toBe("CROSS_TENANT");
  expect(err?.details?.["resourceType"]).toBe("ClinicalDocument");
  expect(JSON.stringify(err)).not.toContain("44444444-4444-4444-8444-444444444444");
 });
 it("un recurso del MISMO tenant pasa",()=>{
  expect(authorize(P(),{scope:"patient:read",resource:{type:"Patient",id:"44444444-4444-4444-8444-444444444444",tenantId:P().tenantId}})).toBe(true);
 });
 it("sin tenant del recurso no finge un chequeo: autoriza por scope y deja el aislamiento a RLS",()=>{
  expect(authorize(P(),{scope:"patient:read",resource:{type:"Patient",id:"44444444-4444-4444-8444-444444444444"}})).toBe(true);
 });
 it("sigue siendo fail-closed en lo que sí decide: sesión, scope, rol y propósito",()=>{
  expect(()=>authorize(P({sessionId:""}),{scope:"patient:read"})).toThrow(/session/i);
  expect(()=>authorize(P(),{scope:""})).toThrow(/requires a scope/);
  expect(()=>authorize(P({roles:["NURSE"]}),{scope:"patient:read",role:"PHYSICIAN"})).toThrow(/role/i);
  expect(()=>authorize(P({scopes:["patient:read"]}),{scope:"patient:write"})).toThrow(/scope/i);
  expect(()=>authorize(P({purpose:"BILLING"}),{scope:"patient:read",purpose:"TREATMENT"})).toThrow(/Purpose/);
 });
 it("assertResourceInTenant compara el tenant de un recurso ya leído",()=>{
  expect(()=>assertResourceInTenant(P(),{type:"Encounter",id:"55555555-5555-4555-8555-555555555555",tenantId:OTRO_TENANT})).toThrow(/Cross-tenant/);
  expect(()=>assertResourceInTenant(P(),{type:"Encounter",id:"55555555-5555-4555-8555-555555555555",tenantId:P().tenantId})).not.toThrow();
  expect(()=>assertResourceInTenant(P(),{type:"Encounter",id:"55555555-5555-4555-8555-555555555555"})).not.toThrow();
 });
});

describe("política de acceso a pacientes: decisión declarada, no accidente (R01-003, ADR-0230)",()=>{
 it("la política vigente es TENANT_WIDE y vive en UN solo sitio",()=>{
  expect(patientAccessPolicy()).toBe("TENANT_WIDE");
  const src=fs.readFileSync("packages/runtime-auth/src/index.ts","utf8");
  expect(src).toContain("CARE_RELATIONSHIP"); // el otro estado existe y está implementado en el mismo punto
 });
 it("con TENANT_WIDE, un clínico del tenant SIN relación asistencial puede leer: es la decisión del ADR-0230",()=>{
  // Se fija el comportamiento ACTUAL a propósito. Si algún día la política cambia, este test debe cambiar con ella,
  // y con un solo cambio en patientAccessPolicy() — no en 97 rutas.
  const otroMedico=P({actorId:"66666666-6666-4666-8666-666666666666"});
  expect(authorize(otroMedico,{scope:"patient:read",resource:{type:"Patient",id:"44444444-4444-4444-8444-444444444444",patientId:"44444444-4444-4444-8444-444444444444"}})).toBe(true);
 });
 it("el control compensatorio de esa decisión existe: toda lectura de PHI deja constancia",()=>{
  // ADR-0230 acepta el acceso amplio dentro del tenant PORQUE la lectura queda auditada (R01-026).
  expect(runtimeSource()).toContain("logPhiAccess");
  expect(fs.existsSync("db/migrations/0024_phi_access_log.sql")).toBe(true);
 });
 it("el ADR declara la deuda con su nombre y su condición de salida",()=>{
  const adr=fs.readFileSync("docs/adr/ADR-0230-modelo-de-acceso-a-pacientes.md","utf8");
  expect(adr).toMatch(/relaci[óo]n/i);
  expect(adr).toMatch(/deuda/i);
 });
});

describe("ninguna llamada vuelve a comparar los claims consigo mismos (R01-019)",()=>{
 it("no queda ningún `tenantId: <claims>.tenantId` en una llamada a authorize",()=>{
  const sospechosos:string[]=[];
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   if(e.name==="node_modules"||e.name===".next"||e.name.includes(" 2."))continue;
   const p=path.join(d,e.name);
   if(e.isDirectory())walk(p);
   else if(/\.tsx?$/.test(e.name)){
    const src=fs.readFileSync(p,"utf8");
    if(/authorize\([^)]*\{\s*tenantId:\s*\w+\.tenantId/.test(src))sospechosos.push(p);
    if(/\{tenantId:(claims|c)\.tenantId,(role|scope)/.test(src))sospechosos.push(p);
   }}};
  walk("apps/web");
  expect([...new Set(sospechosos)]).toEqual([]);
 });
 it("las 97 llamadas siguen exigiendo scope (el modelo no se debilitó al quitar la tautología)",()=>{
  let conScope=0,total=0;
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   if(e.name==="node_modules"||e.name===".next"||e.name.includes(" 2."))continue;
   const p=path.join(d,e.name);
   if(e.isDirectory())walk(p);
   else if(/\.ts$/.test(e.name)){
    const src=fs.readFileSync(p,"utf8");
    // Una llamada puede ocupar varias líneas y llevar el objeto en una variable (`opts`): se mira la línea completa.
    for(const linea of src.split("\n")){
     if(!/\bauthorize\(/.test(linea)||/export function authorize|\* /.test(linea))continue;
     total++;
     if(/scope:/.test(linea)||/\bopts\b/.test(linea))conScope++;
    }
   }}};
  walk("apps/web");
  expect(total).toBeGreaterThanOrEqual(90);
  expect(conScope).toBe(total);
 });
});
