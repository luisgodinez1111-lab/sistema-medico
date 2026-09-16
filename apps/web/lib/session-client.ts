// EPIC J — Puente de cliente (navegador): intercambia el token del IdP por una sesión medical-os
// y la guarda para usarla como Bearer en la API clínica. Sin dependencias de framework; testeable.
export type MedicalSession=Readonly<{token:string;sessionId:string;expiresAt:number;tokenType:string}>;
const STORAGE_KEY="medical-os.session";

// Valida y normaliza la respuesta de POST /api/v1/sessions.
export function parseSessionResponse(json:unknown):MedicalSession{
 const j=json as Partial<MedicalSession>;
 if(!j||typeof j.token!=="string"||typeof j.sessionId!=="string"||typeof j.expiresAt!=="number"){
  throw new Error("INVALID_SESSION_RESPONSE");
 }
 return Object.freeze({token:j.token,sessionId:j.sessionId,expiresAt:j.expiresAt,tokenType:j.tokenType??"Bearer"});
}
// Intercambia un token del IdP (access token OIDC) por una sesión medical-os firmada.
export async function exchangeForSession(idpToken:string,fetchImpl:typeof fetch=fetch):Promise<MedicalSession>{
 const res=await fetchImpl("/api/v1/sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:idpToken})});
 if(!res.ok){
  let code="SESSION_EXCHANGE_FAILED";
  try{const b=await res.json();code=b?.error?.code??code;}catch{/* sin cuerpo json */}
  throw new Error(`${res.status}:${code}`);
 }
 return parseSessionResponse(await res.json());
}
// Persistencia por-pestaña (sessionStorage): el token no sobrevive al cierre; se re-emite al entrar.
function storage():Storage|null{try{return globalThis.sessionStorage??null;}catch{return null;}}
export function storeSession(s:MedicalSession,store:Storage|null=storage()){try{store?.setItem(STORAGE_KEY,JSON.stringify(s));}catch{/* almacenamiento no disponible */}}
export function getStoredSession(store:Storage|null=storage()):MedicalSession|null{
 try{const raw=store?.getItem(STORAGE_KEY);if(!raw)return null;const s=parseSessionResponse(JSON.parse(raw));return s.expiresAt*1000>Date.now()?s:null;}catch{return null;}
}
export function clearStoredSession(store:Storage|null=storage()){try{store?.removeItem(STORAGE_KEY);}catch{/* noop */}}
// Cabecera de autorización para llamar a la API clínica con la sesión activa.
export function authHeader(s:MedicalSession|null=getStoredSession()):Record<string,string>{
 return s?{authorization:`${s.tokenType} ${s.token}`}:{};
}
// Llamada autenticada a la API clínica con Idempotency-Key + If-Match (concurrencia optimista).
export type ApiResult=Readonly<{status:number;body:Record<string,unknown>}>;
export async function apiRequest(path:string,init:{method:string;body?:unknown;ifMatch?:number},fetchImpl:typeof fetch=fetch):Promise<ApiResult>{
 const headers:Record<string,string>={...authHeader()};
 if(init.body!==undefined){headers["content-type"]="application/json";headers["idempotency-key"]=globalThis.crypto.randomUUID();}
 if(init.ifMatch!==undefined)headers["if-match"]=String(init.ifMatch);
 const res=await fetchImpl(path,{method:init.method,headers,...(init.body!==undefined?{body:JSON.stringify(init.body)}:{})});
 let body:Record<string,unknown>={};
 try{body=await res.json() as Record<string,unknown>;}catch{/* sin cuerpo */}
 return{status:res.status,body};
}
