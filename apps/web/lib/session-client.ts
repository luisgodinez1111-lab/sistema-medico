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
//
// Auditoría 2026-09-19 (S-05) — EL CLIENTE RESPETA LA IDEMPOTENCIA. El servidor la implementa bien, pero antes cada
// llamada estrenaba una `Idempotency-Key`: el reintento lo hacía el médico a mano (clic de nuevo = comando distinto =
// receta u orden duplicada si la primera sí había llegado) y un doble clic eran dos comandos. Ahora:
//   1) REINTENTO AUTOMÁTICO con la MISMA llave y el MISMO cuerpo ante fallo de red, 502/503/504 o "comando aún en curso".
//      Eso es exactamente lo que la llave garantiza: si el primer intento llegó, el reintento devuelve su respuesta.
//   2) GUARDA DE DOBLE ENVÍO: mientras una mutación está en vuelo, otra de la MISMA acción (método + ruta + If-Match +
//      cuerpo, ignorando lo que el cliente genera en cada clic) NO se envía y devuelve un 409 local explícito. No se
//      comparte la respuesta de la primera: el segundo manejador creería creado un id que nunca se envió.
//
// Auditoría 2026-09-19, anexo R05a (R05a-F06 / WS1-05) — CANCELACIÓN REAL DE LAS LECTURAS EN VUELO.
// No existía `AbortController` en NINGUNA parte del repositorio: el patrón `let cancelled=false` de los efectos evitaba
// PINTAR una respuesta tardía, pero la petición seguía viva. Cambiar de paciente cinco veces seguidas —normal en un
// consultorio y en triage— dejaba cinco cargas completas del expediente compitiendo por la red y por el servidor, y la
// del paciente equivocado llegaba igual: solo que al llegar se tiraba.
//
// LAS MUTACIONES NO SE CANCELAN, y no es una omisión. Abortar un POST corta la ESPERA del cliente, no el comando: si el
// servidor ya lo recibió, la receta quedó prescrita y la pantalla creería que no pasó nada, que es el peor resultado
// posible en un expediente. Para eso están la Idempotency-Key y la guarda de doble envío de arriba: el reintento es
// seguro porque la llave lo hace idempotente. Pasar `signal` en una mutación es un error de programación y se avisa como
// tal, en vez de dar una falsa sensación de cancelación.
export type ApiResult=Readonly<{status:number;body:Record<string,unknown>}>;
export type ApiInit=Readonly<{method:string;body?:unknown;ifMatch?:number;idempotencyKey?:string;signal?:AbortSignal}>;
/** Distingue «lo cancelamos nosotros» de «la red falló»: lo primero no es un error que el médico deba ver. */
export function isAbortError(e:unknown):boolean{
 return e instanceof Error&&(e.name==="AbortError"||e.name==="TimeoutError");
}
export type ApiRetryOptions=Readonly<{retries?:number;backoffMs?:readonly number[];sleep?:(ms:number)=>Promise<void>}>;
const RETRYABLE_STATUS:ReadonlySet<number>=new Set([502,503,504]);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inFlight=new Set<string>();
const defaultSleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
function canonical(v:unknown):string{
 if(v===null||typeof v!=="object")return JSON.stringify(v)??"null";
 if(Array.isArray(v))return`[${v.map(canonical).join(",")}]`;
 const o=v as Record<string,unknown>;
 return`{${Object.keys(o).filter(k=>o[k]!==undefined).sort().map(k=>`${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}
// Huella de la ACCIÓN del usuario. Se ignoran `occurredAt` y los UUID de primer nivel que el cliente genera en cada clic
// (resultId, orderId, medicationId…); `patientId` SÍ cuenta: la misma acción para dos pacientes son dos acciones.
export function actionFingerprint(path:string,init:ApiInit):string{
 let body:unknown=init.body;
 if(body!==null&&typeof body==="object"&&!Array.isArray(body))
  body=Object.fromEntries(Object.entries(body as Record<string,unknown>).filter(([k,v])=>k!=="occurredAt"&&(k==="patientId"||!(typeof v==="string"&&UUID_RE.test(v)))));
 return`${init.method} ${path} ${init.ifMatch??""} ${canonical(body)}`;
}
export async function apiRequest(path:string,init:ApiInit,fetchImpl:typeof fetch=fetch,retry:ApiRetryOptions={}):Promise<ApiResult>{
 const mutation=init.body!==undefined;
 // R05a-F06: una mutación no se cancela (ver la nota de arriba). Se avisa en vez de aceptar la señal y no cumplirla.
 if(mutation&&init.signal)throw new Error("MUTATION_NOT_CANCELLABLE: una mutación no acepta `signal`; abortar el fetch no deshace el comando en el servidor. Use la Idempotency-Key para reintentar.");
 const fp=mutation?actionFingerprint(path,init):"";
 if(mutation){
  if(inFlight.has(fp))return{status:409,body:{error:{code:"DUPLICATE_IN_FLIGHT",message:"Esta acción ya se está procesando; espere a que termine."}}};
  inFlight.add(fp);
 }
 try{
  const headers:Record<string,string>={...authHeader()};
  // La llave se fija UNA vez por acción y se reutiliza en todos los intentos.
  if(mutation){headers["content-type"]="application/json";headers["idempotency-key"]=init.idempotencyKey??globalThis.crypto.randomUUID();}
  if(init.ifMatch!==undefined)headers["if-match"]=String(init.ifMatch);
  const payload=mutation?JSON.stringify(init.body):undefined; // se serializa UNA vez: todos los intentos envían lo mismo
  const backoff=retry.backoffMs??[300,900];const maxRetries=Math.min(retry.retries??backoff.length,backoff.length);const sleep=retry.sleep??defaultSleep;
  for(let attempt=0;;attempt++){
   let res:Response|undefined;let networkError:unknown;
   try{res=await fetchImpl(path,{method:init.method,headers,credentials:"same-origin",...(init.signal?{signal:init.signal}:{}),...(payload!==undefined?{body:payload}:{})});}
   catch(e){
    // R05a-F06: una lectura CANCELADA no se reintenta. Sin esto, cancelar habría disparado MÁS peticiones: el abort llega
    // como fallo de red y el reintento automático (S-05) lo habría tratado como tal.
    if(isAbortError(e)||init.signal?.aborted)throw e;
    networkError=e;
   }
   let body:Record<string,unknown>={};
   if(res){try{body=await res.json() as Record<string,unknown>;}catch{/* respuesta sin cuerpo JSON */}}
   const inProgress=res?.status===409&&(body["error"] as {message?:unknown}|undefined)?.message==="IDEMPOTENCY_IN_PROGRESS";
   const retryable=res===undefined||RETRYABLE_STATUS.has(res.status)||inProgress;
   if(!retryable||attempt>=maxRetries){
    if(res===undefined)throw networkError instanceof Error?networkError:new Error(String(networkError));
    return{status:res.status,body};
   }
   await sleep(backoff[attempt]??0);
  }
 }finally{if(mutation)inFlight.delete(fp);}
}
// Subida multipart autenticada (adjuntos binarios). NO fijamos content-type: el navegador pone el boundary.
// Idempotency-Key para que el reintento sea idempotente; cookie httpOnly same-origin para la auth.
export async function apiUpload(path:string,formData:FormData,fetchImpl:typeof fetch=fetch):Promise<ApiResult>{
 const headers:Record<string,string>={...authHeader(),"idempotency-key":globalThis.crypto.randomUUID()};
 const res=await fetchImpl(path,{method:"POST",headers,credentials:"same-origin",body:formData});
 let body:Record<string,unknown>={};
 try{body=await res.json() as Record<string,unknown>;}catch{/* sin cuerpo */}
 return{status:res.status,body};
}
// DELETE autenticado con Idempotency-Key (p. ej. quitar un adjunto).
export async function apiDelete(path:string,fetchImpl:typeof fetch=fetch):Promise<ApiResult>{
 const headers:Record<string,string>={...authHeader(),"idempotency-key":globalThis.crypto.randomUUID()};
 const res=await fetchImpl(path,{method:"DELETE",headers,credentials:"same-origin"});
 let body:Record<string,unknown>={};
 try{body=await res.json() as Record<string,unknown>;}catch{/* sin cuerpo */}
 return{status:res.status,body};
}
// Descarga binaria autenticada: devuelve un Blob (o null) para verlo/guardarlo desde la UI.
export async function apiDownload(path:string,fetchImpl:typeof fetch=fetch):Promise<Blob|null>{
 const res=await fetchImpl(path,{method:"GET",headers:{...authHeader()},credentials:"same-origin"});
 if(!res.ok)return null;
 return await res.blob();
}
