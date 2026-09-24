// Vocabulario de estados de ORDEN y RESULTADO. Auditoría 2026-09-19, anexo R02a (RES-02): había cuatro vocabularios de
// «estado de resultado» conviviendo —este (8 estados), `clinical-safety/src/invariants.ts` (15), el fold real y los
// paquetes de corrección—, y además este módulo exportaba dos funciones (`closeResult`, `correctResult`) que NINGÚN
// camino de código llamaba: el ciclo de vida real vive en `apps/web/lib/result-lifecycle.ts` sobre `packages/result-fold`.
//
// Qué queda aquí y por qué: SOLO el vocabulario, que es lo que de verdad comparten la orden, el resultado y las lecturas.
// El comportamiento (qué transición es legal, qué anota una corrección) vive en un único sitio, el fold, para que no
// pueda haber dos respuestas distintas a la misma pregunta.
//
// Estados que el fold REALMENTE produce hoy: RECEIVED → VERIFIED → ACTIONED → CLOSED, y `CORRECTED` como ANOTACIÓN
// (una corrección no cambia el estado del original: lo marca `supersededBy` y crea un resultado nuevo — C-02).
// Los demás (`EXPECTED`, `REVIEWED`, `PATIENT_INFORMED`) se conservan porque los usan lecturas y contratos de
// trazabilidad, y están marcados como tales: si alguien añade una transición hacia ellos, tiene que añadirla al fold.
export type OrderState="DRAFT"|"ORDERED"|"CANCELLED"|"FULFILLED";
/** Estados del ciclo de vida de un resultado. Los marcados «(sin transición)» no los produce ningún handler hoy. */
export type ResultState=
 |"EXPECTED"          // (sin transición) resultado esperado por una orden, aún no recibido
 |"RECEIVED"
 |"VERIFIED"
 |"REVIEWED"          // (sin transición) revisión intermedia no implementada
 |"ACTIONED"
 |"PATIENT_INFORMED"  // (sin transición) no implementado: el aviso al paciente no está construido
 |"CLOSED"
 |"CORRECTED";        // anotación sobre el original, no un estado del ciclo (ver result-fold)
export type Result=Readonly<{id:string;orderId:string;state:ResultState;version:number;supersedes?:string;closureEvidence?:string}>;
