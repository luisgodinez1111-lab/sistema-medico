export type ApiContext=Readonly<{tenantId:string;actorId:string;role:string;purpose:string;requestId:string}>;
export function requireClinicalContext(x:ApiContext){for(const k of ["tenantId","actorId","role","purpose","requestId"] as const)if(!x[k])throw new Error(`API_CONTEXT_MISSING:${k}`);return x;}
export function mutationHeaders(h:Record<string,string|undefined>){if(!h["idempotency-key"])throw new Error("IDEMPOTENCY_KEY_REQUIRED");if(!h["if-match"])throw new Error("IF_MATCH_REQUIRED");return true;}
