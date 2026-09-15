import{describe,it,expect}from"vitest";
import{signSession,verifySession}from"../../packages/session/src";
import{issueSession,devIdentityVerifier}from"../../packages/session-issuance/src";
import{ClinicalError}from"../../packages/runtime-errors/src";

const IDP_SECRET="dev-idp-secret";
const SESSION_SECRET="medical-os-session-secret";
const NOW=2_000_000;
function assertion(over:Partial<Parameters<typeof signSession>[0]>={}){
 return signSession({sub:"dr-1",tenantId:"tenant-9",roles:["PHYSICIAN"],scopes:["encounter:write","encounter:read"],purpose:"TREATMENT",iat:NOW-5,exp:NOW+600,sessionId:"idp-sess",...over},IDP_SECRET);
}

describe("session issuance boundary (EPIC E)",()=>{
 it("dev verifier maps a valid assertion to a verified identity",()=>{
  const v=devIdentityVerifier(IDP_SECRET,NOW)({assertion:assertion()});
  expect(v.subject).toBe("dr-1");expect(v.tenantId).toBe("tenant-9");expect(v.roles).toContain("PHYSICIAN");expect(v.issuer).toBe("dev-idp");
 });
 it("issues a session token verifiable with the session secret (distinct from IdP secret)",()=>{
  const v=devIdentityVerifier(IDP_SECRET,NOW)({assertion:assertion()});
  const s=issueSession(v,SESSION_SECRET,{now:NOW,ttlSeconds:900,sessionId:"sess-1"});
  const claims=verifySession(s.token,SESSION_SECRET,NOW);
  expect(claims.sub).toBe("dr-1");expect(claims.tenantId).toBe("tenant-9");expect(claims.exp).toBe(NOW+900);expect(s.expiresAt).toBe(NOW+900);
  // El token NO se verifica con el secreto del IdP: secretos separados.
  expect(()=>verifySession(s.token,IDP_SECRET,NOW)).toThrow();
 });
 it("rejects a tampered assertion",()=>{
  const err=(()=>{try{devIdentityVerifier(IDP_SECRET,NOW)({assertion:assertion()+"x"});}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("UNAUTHENTICATED");
 });
 it("rejects an expired assertion",()=>{
  const err=(()=>{try{devIdentityVerifier(IDP_SECRET,NOW)({assertion:assertion({iat:NOW-1200,exp:NOW-600})});}catch(e){return e;}})();
  expect((err as ClinicalError).code).toBe("UNAUTHENTICATED");
 });
 it("rejects a missing assertion",()=>{
  const err=(()=>{try{devIdentityVerifier(IDP_SECRET,NOW)({});}catch(e){return e;}})();
  expect((err as ClinicalError).code).toBe("UNAUTHENTICATED");
 });
 it("fails closed if the session secret is not configured",()=>{
  const v=devIdentityVerifier(IDP_SECRET,NOW)({assertion:assertion()});
  const err=(()=>{try{issueSession(v,"",{now:NOW,ttlSeconds:900,sessionId:"s"});}catch(e){return e;}})();
  expect((err as ClinicalError).code).toBe("SAFETY_BLOCKED");
 });
});
