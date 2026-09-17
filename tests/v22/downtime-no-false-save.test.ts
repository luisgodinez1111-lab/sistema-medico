import{describe,it,expect}from"vitest";
import{toHttpError}from"../../apps/web/lib/http-errors";
import{ClinicalError}from"../../packages/runtime-errors/src";
// EPIC BH (ENG-055-R004) — "Nunca mostrar 'guardado' en falso". Un fallo o indisponibilidad NUNCA debe
// devolver un status de éxito (2xx). En particular, una BD caída -> 503 (downtime), no un éxito silencioso.
const CODES=["VALIDATION_ERROR","UNAUTHENTICATED","FORBIDDEN","CROSS_TENANT","NOT_FOUND","CONFLICT","CONCURRENCY_CONFLICT","IDEMPOTENCY_CONFLICT","SAFETY_BLOCKED","PRECONDITION_REQUIRED","DEPENDENCY_UNAVAILABLE","INVARIANT_VIOLATION"] as const;
describe("downtime / no-false-save (ENG-055-R004)",()=>{
 it("BD indisponible -> 503 (Service Unavailable), jamás un éxito silencioso",()=>{
  const h=toHttpError(new ClinicalError("DEPENDENCY_UNAVAILABLE","db down"));
  expect(h.status).toBe(503);
  expect(h.body.error.code).toBe("DEPENDENCY_UNAVAILABLE");
 });
 it("NINGÚN código de error de dominio mapea a un status 2xx (imposible 'guardar' en falso)",()=>{
  for(const c of CODES){
   const h=toHttpError(new ClinicalError(c,"x"));
   expect(h.status,`${c} no debe ser 2xx`).toBeGreaterThanOrEqual(400);
  }
 });
 it("un error inesperado (no-ClinicalError) -> 500 fail-closed, sin filtrar detalle",()=>{
  const h=toHttpError(new Error("kaboom con PHI: Juan Pérez E11.9"));
  expect(h.status).toBe(500);
  expect(h.body.error.code).toBe("INTERNAL");
  expect(JSON.stringify(h.body)).not.toContain("Juan");
 });
});
