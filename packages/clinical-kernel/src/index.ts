export type ClinicalCommandResult<T>=Readonly<{data:T;events:readonly unknown[];obligations:readonly unknown[];audit:readonly unknown[]}>;
export function enforceKernelResult<T>(x:ClinicalCommandResult<T>){if(!Array.isArray(x.events)||!Array.isArray(x.audit))throw new Error("KERNEL_EVIDENCE_MISSING");return Object.freeze(x);}
