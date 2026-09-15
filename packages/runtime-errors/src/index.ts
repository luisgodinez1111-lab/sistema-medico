export type ClinicalErrorCode =
 "VALIDATION_ERROR"|"UNAUTHENTICATED"|"FORBIDDEN"|"CROSS_TENANT"|"NOT_FOUND"|"CONFLICT"|
 "CONCURRENCY_CONFLICT"|"IDEMPOTENCY_CONFLICT"|"SAFETY_BLOCKED"|"PRECONDITION_REQUIRED"|
 "DEPENDENCY_UNAVAILABLE"|"INVARIANT_VIOLATION";
export class ClinicalError extends Error {
 constructor(public readonly code:ClinicalErrorCode,message:string,public readonly details?:Readonly<Record<string,unknown>>){
  super(message); this.name="ClinicalError";
 }
}
