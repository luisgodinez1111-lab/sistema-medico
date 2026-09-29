import{ClinicalError,type ClinicalErrorCode}from"../../../packages/runtime-errors/src";
// EPIC B — Traducción determinista de fallos de dominio a HTTP, fail-closed y sin PHI.
// Nunca serializa `details` crudos ni el payload clínico: solo {code,message} estables, más las claves de `details`
// expresamente listadas en EXPOSED_DETAILS (identificadores de barrera y versiones; nunca valores clínicos).
const STATUS:Record<ClinicalErrorCode,number>={
 VALIDATION_ERROR:400,UNAUTHENTICATED:401,FORBIDDEN:403,CROSS_TENANT:403,NOT_FOUND:404,
 CONFLICT:409,CONCURRENCY_CONFLICT:409,IDEMPOTENCY_CONFLICT:409,SAFETY_BLOCKED:403,
 PRECONDITION_REQUIRED:428,DEPENDENCY_UNAVAILABLE:503,INVARIANT_VIOLATION:500,SAFETY_ACK_REQUIRED:428,RATE_LIMITED:429,
};
// El kernel atómico lanza Error(mensaje) plano; se remapea a códigos clínicos.
const KERNEL:Record<string,ClinicalErrorCode>={
 CONCURRENCY_CONFLICT:"CONCURRENCY_CONFLICT",IDEMPOTENCY_CONFLICT:"IDEMPOTENCY_CONFLICT",
 IDEMPOTENCY_IN_PROGRESS:"CONFLICT",
 AGGREGATE_TYPE_MISMATCH:"NOT_FOUND", // Porte D4: el id es de otro tipo de agregado; para este comando no existe
};
// Auditoría U-19: la UI necesita saber QUÉ barreras bloquean y cuáles admiten anulación para ofrecer el diálogo correcto
// (no se puede inferir del texto). Lista cerrada por código y por clave: lo que no está aquí no sale.
const EXPOSED_DETAILS:Partial<Record<ClinicalErrorCode,readonly string[]>>={
 SAFETY_BLOCKED:["barriers","hard","overridable","missing"],
 SAFETY_ACK_REQUIRED:["notEvaluated","notCovered"], // R02a-MED-03: «sin regla en el catálogo» es distinto de «no se pudo evaluar»
 VALIDATION_ERROR:["unmatched","missing","curpIssue","conflictReason"], // U-19 barreras no bloqueantes; U-20 campos legales de la receta; R02a-PAT-03 código estable del defecto (p. ej. DECEASED_BEFORE_BIRTH)
 CONCURRENCY_CONFLICT:["expected","actual"],
 PRECONDITION_REQUIRED:["reason"], // L-05: PHYSICIAN_CREDENTIALS_REQUIRED lleva a la UI al perfil profesional
 UNAUTHENTICATED:["reason"], // R01-014: SESSION_REVOKED distingue «tu sesión fue revocada» de «tu token venció»; es un código estable, no PHI
 RATE_LIMITED:["retryAfterSeconds"], // S-03: el cliente sabe cuánto esperar aunque el 429 venga del handler y no del middleware
 CONFLICT:["conflictWith","conflictReason","duplicateOf","duplicateBy"], // L-12 cita en traslape; L-06 paciente duplicado (identificadores, no PHI)
 // VALIDATION_ERROR también expone `curpIssue` (L-06): código estable del defecto de la CURP.
};
export type HttpError=Readonly<{status:number;body:{error:{code:string;message:string;details?:Readonly<Record<string,unknown>>}}}>;
function exposedDetails(e:ClinicalError):Readonly<Record<string,unknown>>|undefined{
 const keys=EXPOSED_DETAILS[e.code];if(!keys||!e.details)return undefined;
 const out:Record<string,unknown>={};for(const k of keys)if(e.details[k]!==undefined)out[k]=e.details[k];
 return Object.keys(out).length?out:undefined;
}
export function toHttpError(e:unknown):HttpError{
 if(e instanceof ClinicalError){
  const details=exposedDetails(e);
  return{status:STATUS[e.code]??500,body:{error:details?{code:e.code,message:e.message,details}:{code:e.code,message:e.message}}};
 }
 if(e instanceof Error&&KERNEL[e.message]){
  const code=KERNEL[e.message] as ClinicalErrorCode;
  return{status:STATUS[code]??409,body:{error:{code,message:e.message}}};
 }
 // Fail-closed genérico: no se filtra el detalle al cliente, pero SÍ se loguea server-side
 // (mensaje/código, sin PHI) para diagnóstico.
 const detail=e instanceof Error?`${e.name}: ${e.message}`:String(e);
 const code=(e as{code?:unknown})?.code;
 console.error("[clinical] unexpected runtime error ->",detail,code?`(code=${String(code)})`:"");
 return{status:500,body:{error:{code:"INTERNAL",message:"Unexpected runtime error"}}};
}
// Hallazgo D8 — la respuesta HTTP de un fallo, para las rutas que validan sus ids con `pathIds` ANTES de delegar en el handler.
// Sin ella, el VALIDATION_ERROR de un id malformado escapaba del route handler (que no tenía try) y Next respondía un 500 sin
// cuerpo en vez del 400 declarado por R04-007.
export function httpErrorResponse(e:unknown):Response{
 const h=toHttpError(e);
 return Response.json(h.body,{status:h.status});
}
