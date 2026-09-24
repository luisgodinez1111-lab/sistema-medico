import{describe,it,expect}from"vitest";
import fs from "node:fs";
import{redact,safeLog}from"../../packages/secure-logger/src";
import{runtimeSource}from"./_runtime-src";
// Auditoría 2026-09-19, anexo R01 — hallazgos R01-002 (la línea de `set_config` copiada en los 41 read-models) y
// R01-020 (el logger redactaba con lista negra, dejando pasar campos que en este dominio SÍ son PHI).
const src=runtimeSource();

describe("contexto de RLS centralizado en withTenantTx (R01-002)",()=>{
 it("solo el helper fija el contexto de tenant: ninguna consulta suelta repite set_config",()=>{
  const ocurrencias=src.split("set_config('app.tenant_id'").length-1;
  expect(ocurrencias,"set_config solo dentro de withTenantTxRaw (única apertura de transacción de lectura)").toBe(1);
 });
 it("el helper fija las CUATRO variables de sesión que RLS y la auditoría necesitan",()=>{
  const helper=/async function withTenantTxRaw[\s\S]*?\n}/.exec(src)?.[0]??"";
  for(const v of ["app.tenant_id","app.actor_id","app.purpose","app.request_id"])expect(helper,v).toContain(v);
  expect(helper).toContain("true"); // local a la transacción (set_config(...,true)), nunca a la conexión del pool
 });
 it("ningún read-model abre transacción por su cuenta (todo pasa por el helper)",()=>{
  const fuera=src.split("\n").filter(l=>/\.begin\(/.test(l)&&!/withConnectionRetry|getSql\(\)\.begin/.test(l));
  expect(fuera,"líneas con .begin( fuera del helper").toEqual([]);
 });
 it("los read-models usan el helper (el repo no quedó a medio migrar)",()=>{
  const usos=src.split("withTenantTx(ctx,").length-1;
  expect(usos).toBeGreaterThanOrEqual(40);
 });
 it("un fallo de conexión se traduce a dependencia no disponible, nunca a un resultado vacío",()=>{
  expect(src).toContain("DEPENDENCY_UNAVAILABLE");
  expect(src).toMatch(/withConnectionRetry/);
 });
});

describe("logger seguro con allowlist cerrada (R01-020)",()=>{
 it("redacta los campos del dominio que la lista negra dejaba pasar",()=>{
  const entrada={birthDate:"1980-05-02",content:"nota clínica",addendum:"enmienda",substance:"Penicilina",
   reaction:"anafilaxia",occupation:"docente",maritalStatus:"casada",title:"Alta hospitalaria",
   assessment:"impresión diagnóstica",plan:"plan terapéutico",indication:"neumonía"};
  const salida=redact(entrada) as Record<string,unknown>;
  for(const k of Object.keys(entrada))expect(salida[k],k).toBe("[REDACTED]");
 });
 it("sigue redactando secretos y PHI evidente",()=>{
  const salida=redact({password:"x",token:"y",authorization:"Bearer z",curp:"GODL800502HDFXXX09",phone:"555",email:"a@b.c",name:"Ana"}) as Record<string,unknown>;
  for(const k of ["password","token","authorization","curp","phone","email","name"])expect(salida[k],k).toBe("[REDACTED]");
 });
 it("deja pasar solo campos técnicos útiles para operar",()=>{
  const salida=redact({code:"RATE_LIMITED",statusCode:429,tenantId:"t1",requestId:"r1",latencyMs:12,attempt:2}) as Record<string,unknown>;
  expect(salida).toEqual({code:"RATE_LIMITED",statusCode:429,tenantId:"t1",requestId:"r1",latencyMs:12,attempt:2});
 });
 it("un campo NUEVO del dominio se redacta por defecto (la allowlist falla cerrada)",()=>{
  const salida=redact({campoQueNadiePrevio:"valor sensible"}) as Record<string,unknown>;
  expect(salida["campoQueNadiePrevio"]).toBe("[REDACTED]");
 });
 it("redacta también dentro de estructuras anidadas y arreglos",()=>{
  const salida=JSON.parse(safeLog("x",{detalle:{substance:"Penicilina"},lista:[{note:"n"}]})) as Record<string,unknown>;
  expect(JSON.stringify(salida)).not.toContain("Penicilina");
  expect(JSON.stringify(salida)).not.toContain("\"n\"");
 });
});
