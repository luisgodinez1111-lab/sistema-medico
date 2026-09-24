// Auditoría 2026-09-19 (K-02, C-02; comentario corregido en R02a-RES-02) — corrección de resultados: contrato de
// provenance/aciclicidad (abajo, v8) y el linaje monótono de sustitución (DAG) que exige INV-CORE-0007.
//
// ESTADO REAL (23-sep-2026): la corrección SÍ está expuesta por ruta desde el lote 10j —`POST /api/v1/results/:id/correction`
// sobre `apps/web/lib/result-lifecycle.ts`: razón obligatoria, resultado NUEVO con `supersedes`, original anotado
// `CORRECTED` con `supersededBy`, 409 si ya fue corregido— y su evidencia en vivo es
// `scripts/v22/live-result-correction-proof.mts`. Este módulo es el PREDICADO del invariante (aciclicidad del linaje), no
// una implementación paralela del ciclo: `packages/result-correction-runtime` y `packages/result-service`, que sí lo eran,
// se retiraron en el lote 10y. El comentario anterior decía que el ciclo «AÚN NO expone por ruta», lo que dejó de ser
// cierto con el lote 10j y no se actualizó: exactamente el tipo de afirmación desactualizada que la auditoría persigue.
export*from"./corrected-result-dag";
export*from"./replay-impact";
export type Correction=Readonly<{originalId:string;correctedId:string;reason:string;authorId:string;at:string}>;
export function validateCorrection(c:Correction){if(c.originalId===c.correctedId)throw new Error("CORRECTION_SELF_CYCLE");if(!c.reason||!c.authorId)throw new Error("CORRECTION_PROVENANCE_REQUIRED");return true;}
export function assertAcyclic(edges:readonly Correction[]){const next=new Map(edges.map(e=>[e.originalId,e.correctedId]));for(const start of next.keys()){const seen=new Set<string>();let x:string|undefined=start;while(x){if(seen.has(x))throw new Error("CORRECTION_CYCLE");seen.add(x);x=next.get(x)}}return true;}
