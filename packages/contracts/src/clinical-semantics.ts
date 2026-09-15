export type ComputationStatus =
 | "COMPUTED" | "NOT_APPLICABLE" | "NOT_COMPUTABLE" | "INSUFFICIENT_DATA"
 | "CONFLICTING_DATA" | "INVALID_INPUT" | "UNSUPPORTED_UNIT" | "ARTIFACT_UNAVAILABLE"
 | "DEPENDENCY_UNAVAILABLE" | "SAFETY_BLOCKED" | "RUNTIME_ERROR";

export type ComputationResult<T> =
 | { status:"COMPUTED"; value:T; provenance:readonly string[]; version:string }
 | { status:Exclude<ComputationStatus,"COMPUTED">; value?:never; reason:string; provenance:readonly string[]; version:string };

export function requireComputed<T>(x:ComputationResult<T>):T {
 if(x.status!=="COMPUTED") throw new Error(`NOT_COMPUTED:${x.status}:${x.reason}`);
 return x.value;
}
