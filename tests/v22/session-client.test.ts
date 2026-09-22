import{describe,it,expect}from"vitest";
import{parseSessionResponse,exchangeForSession,storeSession,getStoredSession,clearStoredSession,authHeader,apiRequest,actionFingerprint}from"../../apps/web/lib/session-client";

function fakeStore():Storage{const m=new Map<string,string>();return{get length(){return m.size;},clear:()=>m.clear(),getItem:k=>m.get(k)??null,key:i=>[...m.keys()][i]??null,removeItem:k=>{m.delete(k);},setItem:(k,v)=>{m.set(k,v);}};}
const future=Math.floor(Date.now()/1000)+900;
const sample={token:"jwt.abc.def",sessionId:"sess-1",expiresAt:future,tokenType:"Bearer"};
function fetchOk(body:unknown):typeof fetch{return(async()=>({ok:true,status:201,json:async()=>body})) as unknown as typeof fetch;}
function fetchErr(status:number,code:string):typeof fetch{return(async()=>({ok:false,status,json:async()=>({error:{code}})})) as unknown as typeof fetch;}

describe("session-client bridge (EPIC J)",()=>{
 it("parses a valid session response",()=>{
  const s=parseSessionResponse(sample);expect(s.token).toBe("jwt.abc.def");expect(s.tokenType).toBe("Bearer");
 });
 it("rejects an invalid session response",()=>{
  expect(()=>parseSessionResponse({token:1})).toThrow(/INVALID_SESSION_RESPONSE/);
  expect(()=>parseSessionResponse(null)).toThrow(/INVALID_SESSION_RESPONSE/);
 });
 it("exchanges an IdP token for a medical-os session",async()=>{
  const s=await exchangeForSession("idp-token",fetchOk(sample));expect(s.sessionId).toBe("sess-1");
 });
 it("surfaces the error code when the exchange is rejected",async()=>{
  await expect(exchangeForSession("bad",fetchErr(401,"UNAUTHENTICATED"))).rejects.toThrow(/401:UNAUTHENTICATED/);
 });
 it("stores, reads and clears the session (per-tab)",()=>{
  const store=fakeStore();
  storeSession(sample,store);
  expect(getStoredSession(store)?.sessionId).toBe("sess-1");
  clearStoredSession(store);
  expect(getStoredSession(store)).toBeNull();
 });
 it("treats an expired stored session as absent",()=>{
  const store=fakeStore();
  storeSession({...sample,expiresAt:Math.floor(Date.now()/1000)-10},store);
  expect(getStoredSession(store)).toBeNull();
 });
 it("builds an Authorization header from a session",()=>{
  expect(authHeader(sample).authorization).toBe("Bearer jwt.abc.def");
  expect(authHeader(null)).toEqual({});
 });
 it("apiRequest attaches idempotency-key + if-match on writes and parses the result",async()=>{
  const cap:{init?:RequestInit}={};
  const f=(async(_u:string,init:RequestInit)=>{cap.init=init;return{ok:true,status:201,json:async()=>({version:2})};}) as unknown as typeof fetch;
  const r=await apiRequest("/api/v1/encounters/x/assessment",{method:"POST",body:{a:1},ifMatch:1},f);
  expect(r.status).toBe(201);expect(r.body["version"]).toBe(2);
  const h=cap.init!.headers as Record<string,string>;
  expect(h["content-type"]).toBe("application/json");
  expect(typeof h["idempotency-key"]).toBe("string");
  expect(h["if-match"]).toBe("1");
 });
 it("apiRequest GET carries no body/idempotency key",async()=>{
  const cap:{init?:RequestInit}={};
  const f=(async(_u:string,init:RequestInit)=>{cap.init=init;return{ok:true,status:404,json:async()=>({})};}) as unknown as typeof fetch;
  await apiRequest("/api/v1/encounters?encounterId=x",{method:"GET"},f);
  const h=cap.init!.headers as Record<string,string>;
  expect(h["idempotency-key"]).toBeUndefined();
  expect(cap.init!.body).toBeUndefined();
 });
});
// Auditoría 2026-09-19 (S-05) — el cliente respeta la idempotencia: reintenta con la MISMA llave y no envía dos veces la misma acción.
describe("apiRequest — idempotencia real en el cliente (auditoría S-05)",()=>{
 const noSleep={sleep:async()=>{}};
 const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
 it("fallo de red: reintenta con la MISMA Idempotency-Key y el MISMO cuerpo, y devuelve la respuesta del servidor",async()=>{
  const seen:{key:string|null;body:string}[]=[];let n=0;
  const f=(async(_u:RequestInfo|URL,i?:RequestInit)=>{seen.push({key:new Headers(i?.headers).get("idempotency-key"),body:String(i?.body)});if(++n<3)throw new TypeError("Failed to fetch");return json(201,{version:1});}) as typeof fetch;
  const r=await apiRequest("/api/v1/results",{method:"POST",body:{resultId:"a",value:"7"}},f,noSleep);
  expect(r).toEqual({status:201,body:{version:1}});expect(seen).toHaveLength(3);
  expect(new Set(seen.map(s=>s.key)).size).toBe(1);expect(seen[0]!.key).toMatch(/^[0-9a-f-]{36}$/);expect(new Set(seen.map(s=>s.body)).size).toBe(1);
 });
 it("502/503/504 y 'comando aún en curso' se reintentan; un 4xx normal NO",async()=>{
  for(const first of[json(503,{}),json(409,{error:{code:"CONFLICT",message:"IDEMPOTENCY_IN_PROGRESS"}})]){
   let n=0;const f=(async()=>++n===1?first:json(200,{replayed:true})) as typeof fetch;
   expect((await apiRequest("/x",{method:"POST",body:{a:1}},f,noSleep)).status).toBe(200);expect(n).toBe(2);
  }
  let calls=0;const f4=(async()=>{calls++;return json(409,{error:{code:"CONCURRENCY_CONFLICT",message:"CONCURRENCY_CONFLICT"}});}) as typeof fetch;
  expect((await apiRequest("/y",{method:"POST",body:{a:1}},f4,noSleep)).status).toBe(409);expect(calls).toBe(1);
  calls=0;const f400=(async()=>{calls++;return json(400,{});}) as typeof fetch;
  await apiRequest("/z",{method:"POST",body:{a:1}},f400,noSleep);expect(calls).toBe(1);
 });
 it("agotados los reintentos: devuelve el último estado, o relanza el error de red (nunca finge éxito)",async()=>{
  let n=0;const f=(async()=>{n++;return json(503,{});}) as typeof fetch;
  expect((await apiRequest("/w",{method:"POST",body:{a:1}},f,noSleep)).status).toBe(503);expect(n).toBe(3);
  const down=(async()=>{throw new TypeError("Failed to fetch");}) as typeof fetch;
  await expect(apiRequest("/w2",{method:"POST",body:{a:1}},down,noSleep)).rejects.toThrow("Failed to fetch");
 });
 it("doble envío: mientras la primera está en vuelo, la MISMA acción no se envía (409 local) — aunque el clic genere otros UUID",async()=>{
  let release:(r:Response)=>void=()=>{};let sent=0;
  const f=(async()=>{sent++;return new Promise<Response>(res=>{release=res;});}) as typeof fetch;
  const body=(id:string)=>({resultId:id,orderId:crypto.randomUUID(),patientId:"11111111-1111-4111-8111-111111111111",analyte:"GLUCOSE",value:"95",occurredAt:new Date().toISOString()});
  const first=apiRequest("/api/v1/results",{method:"POST",body:body(crypto.randomUUID())},f,noSleep);
  const second=await apiRequest("/api/v1/results",{method:"POST",body:body(crypto.randomUUID())},f,noSleep);
  expect(second.status).toBe(409);expect((second.body["error"] as {code:string}).code).toBe("DUPLICATE_IN_FLIGHT");expect(sent).toBe(1);
  release(json(201,{version:1}));expect((await first).status).toBe(201);
  // terminada la primera, la misma acción vuelve a ser legítima (p. ej. el mismo signo vital una hora después)
  const f2=(async()=>json(201,{version:1})) as typeof fetch;
  expect((await apiRequest("/api/v1/results",{method:"POST",body:body(crypto.randomUUID())},f2,noSleep)).status).toBe(201);
 });
 it("NO confunde acciones distintas: otro paciente, otro valor, otra ruta u otra versión son envíos independientes",()=>{
  const base={method:"POST",body:{resultId:crypto.randomUUID(),patientId:"11111111-1111-4111-8111-111111111111",analyte:"GLUCOSE",value:"95",occurredAt:"2026-09-20T10:00:00.000Z"}};
  const fp=actionFingerprint("/api/v1/results",base);
  expect(actionFingerprint("/api/v1/results",{...base,body:{...base.body,resultId:crypto.randomUUID(),occurredAt:"2026-09-20T10:00:01.000Z"}})).toBe(fp); // mismo clic repetido
  expect(actionFingerprint("/api/v1/results",{...base,body:{...base.body,patientId:"22222222-2222-4222-8222-222222222222"}})).not.toBe(fp);
  expect(actionFingerprint("/api/v1/results",{...base,body:{...base.body,value:"96"}})).not.toBe(fp);
  expect(actionFingerprint("/api/v1/vitals",base)).not.toBe(fp);
  expect(actionFingerprint("/api/v1/results",{...base,ifMatch:2})).not.toBe(actionFingerprint("/api/v1/results",{...base,ifMatch:3}));
 });
 it("una llave explícita del llamador se respeta; las lecturas (GET) ni llevan llave ni se deduplican",async()=>{
  let key:string|null="";const f=(async(_u:RequestInfo|URL,i?:RequestInit)=>{key=new Headers(i?.headers).get("idempotency-key");return json(200,{});}) as typeof fetch;
  await apiRequest("/k",{method:"POST",body:{a:1},idempotencyKey:"clave-del-formulario"},f,noSleep);expect(key).toBe("clave-del-formulario");
  await apiRequest("/k",{method:"GET"},f,noSleep);expect(key).toBeNull();
 });
});
