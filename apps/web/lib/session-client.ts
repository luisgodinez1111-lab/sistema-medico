// EPIC J/L — Puente de cliente (navegador). Tras el login, la sesión viaja en una cookie httpOnly
// puesta por el servidor; el navegador NO persiste el token (solo metadatos no sensibles para UI).
// Las llamadas a la API van con la cookie (same-origin) automáticamente.
export type MedicalSession=Readonly<{sessionId:string;expiresAt:number;tokenType:string;token?:string;physicianName?:string;physicianRole?:string}>;
const STORAGE_KEY="medical-os.session";

// Valida la respuesta de POST /api/v1/sessions (sessionId + expiresAt; token opcional para API clients).
export function parseSessionResponse(json:unknown):MedicalSession{
 const j=json as Partial<MedicalSession>;
 if(!j||typeof j.sessionId!=="string"||typeof j.expiresAt!=="number")throw new Error("INVALID_SESSION_RESPONSE");
 return Object.freeze({sessionId:j.sessionId,expiresAt:j.expiresAt,tokenType:j.tokenType??"Bearer",...(typeof j.token==="string"?{token:j.token}:{}),...(typeof j.physicianName==="string"?{physicianName:j.physicianName}:{}),...(typeof j.physicianRole==="string"?{physicianRole:j.physicianRole}:{})});
}
// Intercambia un token del IdP por una sesión medical-os. El servidor pone la cookie httpOnly;
// aquí devolvemos SOLO metadatos (sin el token) para no persistirlo en JS.
export async function exchangeForSession(idpToken:string,fetchImpl:typeof fetch=fetch):Promise<MedicalSession>{
 const res=await fetchImpl("/api/v1/sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:idpToken})});
 if(!res.ok){
  let code="SESSION_EXCHANGE_FAILED";
  try{const b=await res.json();code=b?.error?.code??code;}catch{/* sin cuerpo json */}
  throw new Error(`${res.status}:${code}`);
 }
 const s=parseSessionResponse(await res.json());
 return Object.freeze({sessionId:s.sessionId,expiresAt:s.expiresAt,tokenType:s.tokenType});
}
// Cierra la sesión: borra la cookie httpOnly en el servidor y los metadatos locales.
export async function logout(fetchImpl:typeof fetch=fetch):Promise<void>{
 try{await fetchImpl("/api/v1/sessions",{method:"DELETE"});}catch{/* best-effort */}
 clearStoredSession();
}
// Metadatos por-pestaña (sessionStorage): sessionId + expiresAt (NO secretos). La auth real es la cookie.
function storage():Storage|null{try{return globalThis.sessionStorage??null;}catch{return null;}}
export function storeSession(s:MedicalSession,store:Storage|null=storage()){try{store?.setItem(STORAGE_KEY,JSON.stringify({sessionId:s.sessionId,expiresAt:s.expiresAt,tokenType:s.tokenType,...(s.physicianName?{physicianName:s.physicianName}:{}),...(s.physicianRole?{physicianRole:s.physicianRole}:{})}));}catch{/* n/d */}}
export function getStoredSession(store:Storage|null=storage()):MedicalSession|null{
 try{const raw=store?.getItem(STORAGE_KEY);if(!raw)return null;const s=parseSessionResponse(JSON.parse(raw));return s.expiresAt*1000>Date.now()?s:null;}catch{return null;}
}
export function clearStoredSession(store:Storage|null=storage()){try{store?.removeItem(STORAGE_KEY);}catch{/* noop */}}
// Cabecera de autorización: solo si hay token en memoria (API clients); en el navegador va vacía y
// se usa la cookie. Se mantiene por compatibilidad con clientes Bearer.
export function authHeader(s:MedicalSession|null=getStoredSession()):Record<string,string>{
 return s?.token?{authorization:`${s.tokenType} ${s.token}`}:{};
}
// Llamada autenticada a la API clínica con Idempotency-Key + If-Match (concurrencia optimista).
// La cookie httpOnly se envía sola (same-origin); authHeader queda vacío en el navegador.
export type ApiResult=Readonly<{status:number;body:Record<string,unknown>}>;
export async function apiRequest(path:string,init:{method:string;body?:unknown;ifMatch?:number},fetchImpl:typeof fetch=fetch):Promise<ApiResult>{
 const headers:Record<string,string>={...authHeader()};
 if(init.body!==undefined){headers["content-type"]="application/json";headers["idempotency-key"]=globalThis.crypto.randomUUID();}
 if(init.ifMatch!==undefined)headers["if-match"]=String(init.ifMatch);
 const res=await fetchImpl(path,{method:init.method,headers,credentials:"same-origin",...(init.body!==undefined?{body:JSON.stringify(init.body)}:{})});
 let body:Record<string,unknown>={};
 try{body=await res.json() as Record<string,unknown>;}catch{/* sin cuerpo */}
 return{status:res.status,body};
}
