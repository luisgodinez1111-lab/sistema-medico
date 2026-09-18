// Design System v3.2 — módulo importable (tokens + estados prohibidos). Valores verbatim del
// AI Design Implementation Contract (docs/design-contract/). Subordinado al Design System v3.2; no es un maestro.
export const primitive={
 color:{navy:"#102A56",blue:"#1769E0",purple:"#6757E8",cyan:"#20B7D9",
  green:"#168B5B",amber:"#C87B12",red:"#C9364A",canvas:"#F4F7FB",ink:"#14213D",muted:"#5F6B7A",white:"#FFFFFF"},
 space:{0:0,1:4,2:8,3:12,4:16,5:20,6:24,8:32,10:40,12:48},
 radius:{sm:6,md:10,lg:14,xl:18},
 motionMs:{instant:0,fast:120,normal:180,slow:240},
} as const;
export const semantic={
 surface:{canvas:primitive.color.canvas,raised:primitive.color.white},
 text:{primary:primitive.color.ink,muted:primitive.color.muted},
 state:{success:primitive.color.green,attention:primitive.color.amber,critical:primitive.color.red},
 brand:{primary:primitive.color.blue,intelligence:primitive.color.purple},
} as const;
export const typography={
 family:{ui:"Inter, Aptos, system-ui, sans-serif",mono:"ui-monospace, SFMono-Regular, monospace"},
 size:{xs:12,sm:13,base:14,md:16,lg:18,xl:22,xxl:28},
 lineHeight:{tight:1.2,normal:1.45,relaxed:1.6},
} as const;
// Pares de estados que NUNCA pueden coexistir (contracts/forbidden-states.ts, subconjunto vigente en runtime).
export const forbiddenStates=[
 "CRITICAL_OPEN+SIGN_READY","UNKNOWN+NORMAL","AI_RECOMMENDATION+HUMAN_AUTHOR",
 "PATIENT_A_CONTEXT+PATIENT_B_DATA","UNKNOWN_COMMIT_STATE+SUCCESS","CORRECTED+ORIGINAL_DELETED",
 "RESOLVED_OBLIGATION+NO_RESOLUTION_EVIDENCE","ACKNOWLEDGED+IMPLIED_RESOLVED","DRAFT+SIGNED_STYLE",
 "DEGRADED_DEPENDENCY+EMPTY_SUCCESS","PATIENT_SWITCH+OLD_DRAFT_SUBMITTABLE",
] as const;
export function assertNoForbidden(active:readonly string[]):void{
 const s=new Set(active);
 for(const rule of forbiddenStates){const parts=rule.split("+");if(parts.every(p=>s.has(p)))throw new Error(`FORBIDDEN_STATE:${rule}`);}
}
