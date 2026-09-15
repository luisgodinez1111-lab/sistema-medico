import{describe,it,expect,beforeAll}from"vitest";
import{SignJWT,exportJWK,generateKeyPair,createLocalJWKSet,type JWTVerifyGetKey}from"jose";
import{oidcVerifier}from"../../packages/oidc-verifier/src";
import{ClinicalError}from"../../packages/runtime-errors/src";

const ISS="https://idp.example.com/",AUD="medical-os";
let priv:CryptoKey,otherPriv:CryptoKey,jwks:JWTVerifyGetKey,kid="k1";

beforeAll(async()=>{
 const kp=await generateKeyPair("RS256",{extractable:true});priv=kp.privateKey as CryptoKey;
 const other=await generateKeyPair("RS256",{extractable:true});otherPriv=other.privateKey as CryptoKey;
 const pub=await exportJWK(kp.publicKey);
 jwks=createLocalJWKSet({keys:[{...pub,alg:"RS256",kid,use:"sig"}]});
});
async function token(claims:Record<string,unknown>,opts:{iss?:string;aud?:string;exp?:string;signer?:CryptoKey;kidH?:string}={}){
 return new SignJWT(claims).setProtectedHeader({alg:"RS256",kid:opts.kidH??kid}).setIssuedAt().setIssuer(opts.iss??ISS).setAudience(opts.aud??AUD).setSubject(String(claims["sub"]??"dr-1")).setExpirationTime(opts.exp??"1h").sign(opts.signer??priv);
}
const verify=()=>oidcVerifier(jwks,{issuer:ISS,audience:AUD});

describe("OIDC verifier (EPIC F)",()=>{
 it("verifies a valid RS256 token and maps claims",async()=>{
  const t=await token({sub:"dr-7",tenant_id:"tenant-3",roles:["PHYSICIAN"],scope:"encounter:write encounter:read"});
  const v=await verify()({token:t});
  expect(v.subject).toBe("dr-7");expect(v.tenantId).toBe("tenant-3");expect(v.roles).toEqual(["PHYSICIAN"]);
  expect(v.scopes).toEqual(["encounter:write","encounter:read"]);expect(v.issuer).toBe(ISS);expect(v.audience).toBe(AUD);
 });
 it("accepts the raw token string as credential too",async()=>{
  const t=await token({sub:"a",tenant_id:"t",roles:["NURSE"]});
  expect((await verify()(t)).subject).toBe("a");
 });
 async function expectUnauth(p:Promise<unknown>,label:string){
  const err=await p.then(()=>null,e=>e);
  expect(err,label).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("UNAUTHENTICATED");
 }
 it("rejects a token with the wrong audience",async()=>{await expectUnauth(verify()({token:await token({sub:"a",tenant_id:"t",roles:["X"]},{aud:"other"})}),"aud");});
 it("rejects a token from the wrong issuer",async()=>{await expectUnauth(verify()({token:await token({sub:"a",tenant_id:"t",roles:["X"]},{iss:"https://evil/"})}),"iss");});
 it("rejects an expired token",async()=>{await expectUnauth(verify()({token:await token({sub:"a",tenant_id:"t",roles:["X"]},{exp:"-1h"})}),"exp");});
 it("rejects a token signed by a key not in the JWKS",async()=>{await expectUnauth(verify()({token:await token({sub:"a",tenant_id:"t",roles:["X"]},{signer:otherPriv})}),"sig");});
 it("rejects a token missing the tenant claim",async()=>{await expectUnauth(verify()({token:await token({sub:"a",roles:["X"]})}),"tenant");});
 it("rejects a token missing roles",async()=>{await expectUnauth(verify()({token:await token({sub:"a",tenant_id:"t"})}),"roles");});
 it("rejects a missing token",async()=>{await expectUnauth(verify()({}),"missing");});
});
