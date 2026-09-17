import{describe,it,expect,afterEach}from"vitest";
import{devIdentityAllowed,selectVerifier}from"../../apps/web/lib/session-issuance";
// EPIC BJ (endurecimiento G / EXEC no-frontend-authz + IAM hardening) — El verificador de DESARROLLO
// es IMPOSIBLE en producción: no depende de que prod "no ponga el flag", sino de una negación explícita.
const KEYS=["NODE_ENV","VERCEL_ENV","AUTH_MODE","ALLOW_DEV_IDENTITY","DEV_IDENTITY_SECRET","OIDC_ISSUER","OIDC_AUDIENCE"] as const;
const penv=process.env as Record<string,string|undefined>;
const saved:Record<string,string|undefined>={};
function setEnv(e:Record<string,string|undefined>){for(const k of KEYS){saved[k]??=penv[k];if(e[k]===undefined)delete penv[k];else penv[k]=e[k];}}
afterEach(()=>{for(const k of KEYS){if(saved[k]===undefined)delete penv[k];else penv[k]=saved[k];saved[k]=undefined;}});

describe("dev identity verifier: imposible en producción (EPIC BJ)",()=>{
 it("producción + TODOS los flags de dev -> NO permitido (deny-closed)",()=>{
  setEnv({NODE_ENV:"production",AUTH_MODE:"development",ALLOW_DEV_IDENTITY:"true",DEV_IDENTITY_SECRET:"s",VERCEL_ENV:undefined,OIDC_ISSUER:undefined,OIDC_AUDIENCE:undefined});
  expect(devIdentityAllowed()).toBe(false);
  expect(selectVerifier(1000)).toBeUndefined(); // sin OIDC y sin dev -> sin verificador
 });
 it("VERCEL_ENV=production también deshabilita el dev verifier",()=>{
  setEnv({NODE_ENV:"development",VERCEL_ENV:"production",AUTH_MODE:"development",ALLOW_DEV_IDENTITY:"true",DEV_IDENTITY_SECRET:"s",OIDC_ISSUER:undefined,OIDC_AUDIENCE:undefined});
  expect(devIdentityAllowed()).toBe(false);
 });
 it("no-prod + opt-in COMPLETO -> permitido; selectVerifier devuelve el dev verifier",()=>{
  setEnv({NODE_ENV:"development",VERCEL_ENV:undefined,AUTH_MODE:"development",ALLOW_DEV_IDENTITY:"true",DEV_IDENTITY_SECRET:"s",OIDC_ISSUER:undefined,OIDC_AUDIENCE:undefined});
  expect(devIdentityAllowed()).toBe(true);
  expect(typeof selectVerifier(1000)).toBe("function");
 });
 it("no-prod pero opt-in INCOMPLETO -> no permitido (fail-closed por defecto)",()=>{
  setEnv({NODE_ENV:"development",VERCEL_ENV:undefined,AUTH_MODE:"development",ALLOW_DEV_IDENTITY:undefined,DEV_IDENTITY_SECRET:"s",OIDC_ISSUER:undefined,OIDC_AUDIENCE:undefined});
  expect(devIdentityAllowed()).toBe(false); // falta ALLOW_DEV_IDENTITY
  setEnv({ALLOW_DEV_IDENTITY:"true",DEV_IDENTITY_SECRET:undefined});
  expect(devIdentityAllowed()).toBe(false); // falta el secreto
 });
 it("OIDC configurado en producción SÍ desbloquea (mismo código que dev): devuelve verificador",()=>{
  setEnv({NODE_ENV:"production",VERCEL_ENV:"production",OIDC_ISSUER:"https://idp.example.com/",OIDC_AUDIENCE:"medical-os",AUTH_MODE:undefined,ALLOW_DEV_IDENTITY:undefined,DEV_IDENTITY_SECRET:undefined});
  expect(typeof selectVerifier(1000)).toBe("function"); // OIDC funciona en prod (es lo que la desbloquea)
 });
});
