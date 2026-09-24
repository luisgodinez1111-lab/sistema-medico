// Máquina de estados del ENCUENTRO clínico. Auditoría 2026-09-19, anexo R02a (ENC-03): la máquina declaraba seis estados
// —`PLANNED`, `OPEN`, `READY_TO_SIGN`, `SIGNED`, `AMENDED`, `CANCELLED`— pero solo tres existen de verdad:
//
//   · el fold (`packages/encounter-fold`) solo reconoce los kinds OPENED / ASSESSED / SIGNED;
//   · ningún handler ni ruta emite nunca AMENDED ni CANCELLED;
//   · `PLANNED` no es un estado del agregado sino el «antes de existir» (un encuentro nace con OPENED).
//
// Declarar estados que nadie puede alcanzar no es inofensivo en software clínico: hace creer que existe la posibilidad de
// enmendar o cancelar un encuentro. La enmienda de una nota firmada SÍ existe, pero vive en el documento clínico
// (`DOCUMENT_AMENDED`, append-only: la enmienda se añade, el original no se altera), no aquí.
//
// Si algún día se implementa la cancelación de un encuentro, hay que añadir a la vez el estado, el kind en el fold y su
// handler: este tipo obliga a ello, porque `allowed` ya no tiene destinos inventados.
export type EncounterState="OPEN"|"READY_TO_SIGN"|"SIGNED";
/** Estado inicial de un agregado que aún no tiene eventos (no es un estado clínico, es «no existe»). */
export const ENCOUNTER_INITIAL:EncounterState="OPEN";
const allowed:Record<EncounterState,readonly EncounterState[]>={
 OPEN:["READY_TO_SIGN"],
 // Re-valorar una nota antes de firmarla es legítimo: READY_TO_SIGN -> READY_TO_SIGN se trata como anotación en el
 // handler (no pasa por aquí). Volver a OPEN no lo emite nadie.
 READY_TO_SIGN:["SIGNED"],
 // Firmado es terminal: lo firmado es inmutable (ADR-0240). Una corrección posterior es una ENMIENDA del documento.
 SIGNED:[],
};
export function transitionEncounter(from:EncounterState,to:EncounterState){if(!allowed[from].includes(to))throw new Error(`ILLEGAL_ENCOUNTER_TRANSITION:${from}:${to}`);return to;}
