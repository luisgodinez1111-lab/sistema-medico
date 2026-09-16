import{describe,it,expect}from"vitest";
import{signSession}from"../../packages/session/src";
import{resolvePrincipal,subjectToActorId}from"../../packages/http-principal/src";
import{toHttpError}from"../../apps/web/lib/http-errors";
import{ClinicalError}from"../../packages/runtime-errors/src";

const SECRET="epic-b-secret";
const NOW=1_000_000;
function reader(h:Record<string,string>){const m:Record<string,string>={};for(const k in h)m[k.toLowerCase()]=h[k]!;return (n:string)=>m[n.toLowerCase()];}
function token(over:Partial<Parameters<typeof signSession>[0]>={}){
 return signSession({sub:"actor-1",tenantId:"tenant-1",roles:["PHYSICIAN"],scopes:["encounter:write","encounter:read"],purpose:"TREATMENT",iat:NOW-10,exp:NOW+3600,sessionId:"sess-1",...over},SECRET);
}

describe("http-principal (EPIC B session/principal adapter)",()=>{
 it("resolves a verified principal + tenant context (actorId = UUID derivado del subject)",()=>{
  const r=resolvePrincipal(reader({authorization:`Bearer ${token()}`}),SECRET,"req-1",NOW);
  const expectedActor=subjectToActorId("actor-1");
  expect(r.principal.actorId).toBe(expectedActor);
  expect(r.principal.tenantId).toBe("tenant-1");
  expect(r.principal.roles).toContain("PHYSICIAN");
  expect(r.ctx).toEqual({tenantId:"tenant-1",actorId:expectedActor,purpose:"TREATMENT",requestId:"req-1"});
 });
 it("subjectToActorId turns a non-UUID subject (e.g. auth0|...) into a stable UUID",()=>{
  const a=subjectToActorId("auth0|6aa9f025d8fefb812d76ea0d");
  expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  expect(subjectToActorId("auth0|6aa9f025d8fefb812d76ea0d")).toBe(a); // determinista
 });
 it("fails closed when Authorization header is missing",()=>{
  expect(()=>resolvePrincipal(reader({}),SECRET,"req-1",NOW)).toThrowError(/Missing Authorization/);
 });
 it("fails closed on malformed Authorization header",()=>{
  expect(()=>resolvePrincipal(reader({authorization:token()}),SECRET,"req-1",NOW)).toThrowError(/Malformed Authorization/);
 });
 it("fails closed on a tampered token",()=>{
  expect(()=>resolvePrincipal(reader({authorization:`Bearer ${token()}x`}),SECRET,"req-1",NOW)).toThrowError(ClinicalError);
 });
 it("fails closed on an expired session",()=>{
  const t=token({iat:NOW-7200,exp:NOW-3600});
  const err=(()=>{try{resolvePrincipal(reader({authorization:`Bearer ${t}`}),SECRET,"req-1",NOW);}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);
  expect((err as ClinicalError).code).toBe("UNAUTHENTICATED");
 });
 it("fails closed when the signing secret is not configured",()=>{
  const err=(()=>{try{resolvePrincipal(reader({authorization:`Bearer ${token()}`}),"","req-1",NOW);}catch(e){return e;}})();
  expect((err as ClinicalError).code).toBe("SAFETY_BLOCKED");
 });
 it("requires a request id for provenance",()=>{
  const err=(()=>{try{resolvePrincipal(reader({authorization:`Bearer ${token()}`}),SECRET,"",NOW);}catch(e){return e;}})();
  expect((err as ClinicalError).code).toBe("SAFETY_BLOCKED");
 });
});

describe("http-errors (EPIC B fail-closed mapping)",()=>{
 it("maps clinical error codes to HTTP status",()=>{
  expect(toHttpError(new ClinicalError("UNAUTHENTICATED","x")).status).toBe(401);
  expect(toHttpError(new ClinicalError("FORBIDDEN","x")).status).toBe(403);
  expect(toHttpError(new ClinicalError("PRECONDITION_REQUIRED","x")).status).toBe(428);
  expect(toHttpError(new ClinicalError("VALIDATION_ERROR","x")).status).toBe(400);
 });
 it("maps kernel concurrency/idempotency errors to 409",()=>{
  expect(toHttpError(new Error("CONCURRENCY_CONFLICT")).status).toBe(409);
  expect(toHttpError(new Error("IDEMPOTENCY_CONFLICT")).status).toBe(409);
 });
 it("never leaks internal errors",()=>{
  const h=toHttpError(new Error("secret db pool detail"));
  expect(h.status).toBe(500);
  expect(h.body.error.message).toBe("Unexpected runtime error");
  expect(JSON.stringify(h.body)).not.toContain("secret db pool");
 });
});
