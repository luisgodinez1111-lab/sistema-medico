
export type Envelope={
 id:string;risk:"C2"|"C3"|"C4"|"C5";human_approval_required:boolean;kill_switch:boolean;
 evidence_required:boolean;failure_mode:"ABSTAIN"|"SAFETY_BLOCKED"|"DEPENDENCY_UNAVAILABLE"|"INVALID_INPUT";
};
// Auditoría 2026-09-19, anexo R02b (R2B-006, lote 17) — UN SOBRE DE SEGURIDAD NO MEZCLA DOS MECANISMOS DE CONTROL.
//
// Tres ramas devolvían un estado tipado (`SAFETY_BLOCKED`/`ABSTAIN`/`ALLOWED`) y la cuarta —el kill switch no disponible—
// lanzaba un `Error` NATIVO, no un `ClinicalError`. Ese error acababa en el `catch` genérico del handler y salía como 500 sin
// estructura, en vez de la respuesta de bloqueo limpia que el llamador sabe interpretar. El efecto era fail-closed, sí, pero
// por accidente y con la forma equivocada: un 500 se lee como «el sistema se rompió», no como «la barrera actuó».
//
// Ahora las cuatro salidas son el mismo tipo, y el llamador distingue por `status` y `reason` en un solo sitio.
export type EnvelopeStatus="ALLOWED"|"SAFETY_BLOCKED"|"ABSTAIN";
export type EnvelopeVerdict=Readonly<{status:EnvelopeStatus;reason?:string}>;
export function enforceEnvelope(e:Envelope,input:{killSwitchEnabled:boolean;hasEvidence:boolean;humanApproved:boolean}):EnvelopeVerdict{
 // Sin kill switch operativo no se ejecuta nada: es la condición previa a cualquier otra comprobación.
 if(!e.kill_switch || !input.killSwitchEnabled) return {status:"SAFETY_BLOCKED",reason:`AI_KILL_SWITCH_UNAVAILABLE:${e.id}`};
 if((e.risk==="C4"||e.risk==="C5") && e.evidence_required && !input.hasEvidence) return {status:"SAFETY_BLOCKED",reason:`EVIDENCE_REQUIRED:${e.id}`};
 if(e.human_approval_required && !input.humanApproved) return {status:"ABSTAIN",reason:`HUMAN_APPROVAL_REQUIRED:${e.id}`};
 return {status:"ALLOWED"};
}
