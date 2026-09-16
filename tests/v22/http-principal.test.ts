import{describe,it,expect}from"vitest";
import{subjectToActorId}from"../../packages/http-principal/src";
// CAP-UUID-BOUNDARY-001 — el sub de Auth0 (no-UUID) se deriva a un actor_id UUID estable y determinista.
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
describe("subjectToActorId (boundary de identidad, CAP-UUID-BOUNDARY-001)",()=>{
 it("deriva un UUID válido a partir de un sub estilo Auth0",()=>{
  const id=subjectToActorId("auth0|64f0c1a2b3d4e5f6a7b8c9d0");
  expect(id).toMatch(UUID_RE);
 });
 it("es determinista: el mismo sub -> el mismo actor_id",()=>{
  expect(subjectToActorId("auth0|abc")).toBe(subjectToActorId("auth0|abc"));
 });
 it("distintos subs -> distintos actor_id",()=>{
  expect(subjectToActorId("auth0|abc")).not.toBe(subjectToActorId("auth0|xyz"));
 });
});
