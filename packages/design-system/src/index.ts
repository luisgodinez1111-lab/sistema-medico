// Design System v3.2 — módulo importable: tokens (./tokens), componentes (./components) y estados prohibidos.
// Subordinado al Design System v3.2 y al AI Design Implementation Contract (docs/design-contract/); no es un maestro.
export * from "./tokens";
export * from "./components";
// Pares de estados que NUNCA pueden coexistir. Auditoría 2026-09-19 (G-09): el contrato declaraba 20 pares
// (docs/design-contract/contracts/forbidden-states.ts) y el guardián de runtime solo llevaba 11; faltaban justo los de
// mayor riesgo (tenant inválido con PHI, sin autorización con mutaciones, firmado editable, IA obsoleta con auto-aplicar,
// break-glass caducado). Ahora el guardián lleva los 20 y un test exige que ambas listas coincidan.
export const forbiddenStates=[
 "SIGNED+EDITABLE_AUTHORITATIVE","CRITICAL_OPEN+SIGN_READY","UNKNOWN+NORMAL",
 "AI_RECOMMENDATION+HUMAN_AUTHOR","PATIENT_A_CONTEXT+PATIENT_B_DATA",
 "UNKNOWN_COMMIT_STATE+SUCCESS","CORRECTED+ORIGINAL_DELETED",
 "TENANT_INVALID+PHI_INTERACTIVE","UNAUTHORIZED+MUTATION_ENABLED",
 "STALE_AI+AUTO_APPLY_ENABLED","PROJECTION_OLD+OVERRIDES_NEW_RECEIPT",
 "RESOLVED_OBLIGATION+NO_RESOLUTION_EVIDENCE","ACKNOWLEDGED+IMPLIED_RESOLVED",
 "DRAFT+SIGNED_STYLE","DEGRADED_DEPENDENCY+EMPTY_SUCCESS",
 "PATIENT_SWITCH+OLD_DRAFT_SUBMITTABLE","BREAK_GLASS_EXPIRED+ACCESS_ACTIVE",
 "LEGACY_NULL+FALSE_OR_ZERO","CRITICAL_FILTERED_OUT+NO_DISCLOSURE",
 "RESTORE_IN_PROGRESS+NORMAL_OPERATION_CLAIM",
] as const;
export function assertNoForbidden(active:readonly string[]):void{
 const s=new Set(active);
 for(const rule of forbiddenStates){const parts=rule.split("+");if(parts.every(p=>s.has(p)))throw new Error(`FORBIDDEN_STATE:${rule}`);}
}
