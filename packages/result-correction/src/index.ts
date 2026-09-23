// Auditoría 2026-09-19 (K-02, C-02) — corrección de resultados: contrato de provenance/aciclicidad (abajo, v8) más el
// DISEÑO EJECUTABLE del linaje monótono de sustitución (DAG) y la reproducción/impacto por versión de artefacto, que
// exige INV-CORE-0007 y que el ciclo de vida de resultados AÚN NO expone por ruta (deuda declarada C-02). Los dos módulos
// vivían en el antiguo `clinical-kernel` (máquinas paralelas retiradas en el lote 10e); aquí queda claro qué son: la pieza
// que debe cablear el evento RESULT_CORRECTED cuando se diseñe con criterio clínico.
export*from"./corrected-result-dag";
export*from"./replay-impact";
export type Correction=Readonly<{originalId:string;correctedId:string;reason:string;authorId:string;at:string}>;
export function validateCorrection(c:Correction){if(c.originalId===c.correctedId)throw new Error("CORRECTION_SELF_CYCLE");if(!c.reason||!c.authorId)throw new Error("CORRECTION_PROVENANCE_REQUIRED");return true;}
export function assertAcyclic(edges:readonly Correction[]){const next=new Map(edges.map(e=>[e.originalId,e.correctedId]));for(const start of next.keys()){const seen=new Set<string>();let x:string|undefined=start;while(x){if(seen.has(x))throw new Error("CORRECTION_CYCLE");seen.add(x);x=next.get(x)}}return true;}
