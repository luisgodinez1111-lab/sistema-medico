import{ClinicalError,type ClinicalErrorCode}from"../../../packages/runtime-errors/src";
// EPIC B — Traducción determinista de fallos de dominio a HTTP, fail-closed y sin PHI.
// Nunca serializa `details` crudos ni el payload clínico: solo {code,message} estables.
const STATUS:Record<ClinicalErrorCode,number>={
 VALIDATION_ERROR:400,UNAUTHENTICATED:401,FORBIDDEN:403,CROSS_TENANT:403,NOT_FOUND:404,
 CONFLICT:409,CONCURRENCY_CONFLICT:409,IDEMPOTENCY_CONFLICT:409,SAFETY_BLOCKED:403,
 PRECONDITION_REQUIRED:428,DEPENDENCY_UNAVAILABLE:503,INVARIANT_VIOLATION:500,
};
// El kernel atómico lanza Error(mensaje) plano; se remapea a códigos clínicos.
const KERNEL:Record<string,ClinicalErrorCode>={
 CONCURRENCY_CONFLICT:"CONCURRENCY_CONFLICT",IDEMPOTENCY_CONFLICT:"IDEMPOTENCY_CONFLICT",
 IDEMPOTENCY_IN_PROGRESS:"CONFLICT",
};
export type HttpError=Readonly<{status:number;body:{error:{code:string;message:string}}}>;
export function toHttpError(e:unknown):HttpError{
 if(e instanceof ClinicalError){
  return{status:STATUS[e.code]??500,body:{error:{code:e.code,message:e.message}}};
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
