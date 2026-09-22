import{describe,it,expect,beforeEach,afterEach}from"vitest";
import{NextRequest}from"next/server";
import{KeyedRateLimiter,LOGIN_POLICY,WRITE_POLICY,clientIp,writeKey,rateLimitedResponse,loginLimiter,writeLimiter}from"../../apps/web/lib/rate-limit";
import{SESSION_COOKIE}from"../../apps/web/lib/session-cookie-name";
import{SESSION_COOKIE as SESSION_COOKIE_CMD}from"../../apps/web/lib/http-command";
import{middleware}from"../../apps/web/middleware";
import{handleLogin}from"../../apps/web/lib/session-issuance";
// Auditoría 2026-09-19 (S-03) — antes: ningún endpoint, ni el login, tenía límite de tasa.
const T0=1_700_000_000_000;

describe("KeyedRateLimiter (token bucket por llave)",()=>{
 it("login: 10 intentos de golpe, el 11.º se rechaza con Retry-After de 6 s, y a los 6 s vuelve a admitir uno",()=>{
  const l=new KeyedRateLimiter(LOGIN_POLICY);
  for(let i=0;i<10;i++)expect(l.allow("ip:1.1.1.1",T0).allowed,String(i)).toBe(true);
  const d=l.allow("ip:1.1.1.1",T0);expect(d.allowed).toBe(false);expect(d.retryAfterSeconds).toBe(6);expect(d.remaining).toBe(0);
  expect(l.allow("ip:1.1.1.1",T0+5_000).allowed).toBe(false);
  expect(l.allow("ip:1.1.1.1",T0+6_000).allowed).toBe(true);
 });
 it("las llaves son independientes: otra IP no se ve afectada",()=>{
  const l=new KeyedRateLimiter(LOGIN_POLICY);
  for(let i=0;i<11;i++)l.allow("ip:a",T0);
  expect(l.allow("ip:b",T0).allowed).toBe(true);
 });
 it("escrituras: 120 de golpe y luego 2/s sostenidas",()=>{
  const l=new KeyedRateLimiter(WRITE_POLICY);
  for(let i=0;i<120;i++)expect(l.allow("s:x",T0).allowed).toBe(true);
  expect(l.allow("s:x",T0).allowed).toBe(false);
  expect(l.allow("s:x",T0+500).allowed).toBe(true);expect(l.allow("s:x",T0+500).allowed).toBe(false);
 });
 it("memoria acotada: al superar maxKeys se expulsa la llave menos reciente, nunca crece sin límite",()=>{
  const l=new KeyedRateLimiter({capacity:1,refillPerSecond:0,maxKeys:3});
  for(const k of["a","b","c"])l.allow(k,T0);
  l.allow("a",T0+1); // "a" pasa a ser la más reciente
  l.allow("d",T0+2); // expulsa "b" (la menos reciente)
  expect(l.size).toBe(3);
  expect(l.allow("b",T0+3).allowed).toBe(true);  // "b" vuelve con capacidad inicial (fue expulsada)
  expect(l.allow("a",T0+3).allowed).toBe(false); // "a" conserva su estado (sin tokens)
 });
});
describe("llaves",()=>{
 it("IP: primer valor de x-forwarded-for, luego x-real-ip, y una llave compartida si no hay ninguna",()=>{
  expect(clientIp(new Headers({"x-forwarded-for":"203.0.113.9, 10.0.0.1"}))).toBe("203.0.113.9");
  expect(clientIp(new Headers({"x-real-ip":"198.51.100.4"}))).toBe("198.51.100.4");
  expect(clientIp(new Headers())).toBe("unknown");
 });
 it("escrituras: por sesión si hay cookie (cola de la cookie, no la cookie entera), por IP si no",()=>{
  const cookie="a".repeat(40)+"FIRMA-UNICA-DE-LA-SESION-32-chars";
  const k=writeKey(new Headers({"x-forwarded-for":"1.2.3.4"}),cookie);
  expect(k.startsWith("s:")).toBe(true);expect(k.length).toBe(34);expect(k).not.toContain("aaaa");
  expect(writeKey(new Headers({"x-forwarded-for":"1.2.3.4"}),undefined)).toBe("ip:1.2.3.4");
  expect(writeKey(new Headers(),"corta")).toBe("ip:unknown"); // una cookie inválida no sirve de llave
 });
 it("la cookie de sesión tiene UN nombre (el módulo sin Node y http-command coinciden)",()=>{expect(SESSION_COOKIE).toBe(SESSION_COOKIE_CMD);});
 it("el 429 tiene la forma de error de la API, Retry-After y no-store",async()=>{
  const r=rateLimitedResponse({allowed:false,retryAfterSeconds:7,remaining:0});
  expect(r.status).toBe(429);expect(r.headers.get("retry-after")).toBe("7");expect(r.headers.get("cache-control")).toBe("no-store");
  expect(await r.json()).toEqual({error:{code:"RATE_LIMITED",message:"Demasiadas solicitudes. Reintente en 7 s."}});
 });
});
describe("middleware — límite de escrituras en toda la API v1",()=>{
 beforeEach(()=>writeLimiter.reset());afterEach(()=>writeLimiter.reset());
 const req=(method:string,path:string,cookie?:string)=>new NextRequest(`https://clinic.test${path}`,{method,headers:{"x-forwarded-for":"9.9.9.9",...(cookie?{cookie:`${SESSION_COOKIE}=${cookie}`}:{})}});
 it("la escritura 121 de la misma sesión recibe 429; las lecturas nunca se limitan",async()=>{
  const c="c".repeat(64);
  for(let i=0;i<120;i++)expect(middleware(req("POST","/api/v1/results",c)).headers.get("x-middleware-next"),String(i)).toBe("1");
  const r=middleware(req("POST","/api/v1/results",c));expect(r.status).toBe(429);expect(await r.json()).toMatchObject({error:{code:"RATE_LIMITED"}});
  expect(middleware(req("GET","/api/v1/patients",c)).headers.get("x-middleware-next")).toBe("1");
 });
 it("dos sesiones de la MISMA IP no comparten cupo (una clínica entera comparte IP)",()=>{
  const a="a".repeat(64),b="b".repeat(64);
  for(let i=0;i<121;i++)middleware(req("POST","/api/v1/vitals",a));
  expect(middleware(req("POST","/api/v1/vitals",b)).headers.get("x-middleware-next")).toBe("1");
 });
 it("el login NO pasa por este límite (tiene el suyo por IP dentro del handler)",()=>{
  for(let i=0;i<121;i++)middleware(req("POST","/api/v1/results"));
  expect(middleware(req("POST","/api/v1/sessions")).headers.get("x-middleware-next")).toBe("1");
 });
});
describe("login — límite por IP antes de verificar la credencial",()=>{
 beforeEach(()=>loginLimiter.reset());afterEach(()=>loginLimiter.reset());
 const attempt=(ip:string)=>handleLogin(new Request("https://clinic.test/api/v1/sessions",{method:"POST",headers:{"content-type":"application/json","x-forwarded-for":ip},body:JSON.stringify({token:"no-es-un-token"})}));
 it("el 11.º intento desde la misma IP es 429 aunque los anteriores hayan fallado; otra IP sigue pudiendo intentar",async()=>{
  for(let i=0;i<10;i++)expect((await attempt("203.0.113.5")).status,String(i)).not.toBe(429);
  const r=await attempt("203.0.113.5");expect(r.status).toBe(429);expect(r.headers.get("retry-after")).toBe("6");
  expect((await attempt("203.0.113.6")).status).not.toBe(429);
 });
});
