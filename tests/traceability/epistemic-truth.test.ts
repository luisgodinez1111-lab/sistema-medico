import {describe,it,expect} from "vitest";
import {invPhysicianAuthority} from "../../packages/clinical-safety/src/invariants";
import {authorize} from "../../packages/runtime-auth/src";
import {assertProblemAnnotation} from "../../packages/problem-fold/src";
// Auditoría 2026-09-19 (K-02): Physician Control contra el código REAL: el invariante ejecutable INV-CORE-0003 y la
// autorización que aplican los handlers (prescribir y firmar exigen el rol PHYSICIAN en el servidor; la IA nunca lo tiene).
const ai={tenantId:"t",actorId:"ai",roles:["AI"],scopes:["medication:write","encounter:write"],purpose:"TREATMENT",sessionId:"s"};
describe("Clinical Truthfulness (código real)",()=>{
 it("blocks AI from deciding or signing",()=>{
  expect(()=>invPhysicianAuthority("DECIDED","AI")).toThrow();
  expect(()=>invPhysicianAuthority("SIGNED","SYSTEM")).toThrow();
  expect(()=>invPhysicianAuthority("RECOMMENDED","AI")).not.toThrow();
  expect(()=>authorize(ai,{tenantId:"t",role:"PHYSICIAN",scope:"medication:write",purpose:"TREATMENT"})).toThrow(/Required role missing/);
 });
 it("una hipótesis no se vuelve verdad en silencio: el estado epistémico de un problema cambia con un evento explícito sobre un problema en curso",()=>{
  expect(()=>assertProblemAnnotation("ACTIVE","EPISTEMIC_CHANGED")).not.toThrow();
  expect(()=>assertProblemAnnotation("ENTERED_IN_ERROR","EPISTEMIC_CHANGED")).toThrow(); // un problema anulado no cambia de estatus epistémico
 });
});
