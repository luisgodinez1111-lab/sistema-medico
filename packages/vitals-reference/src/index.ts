// EPIC AN — Interpretación de signos vitales por rangos de referencia (PROFUNDIDAD del eje C / CDS).
// AUDITORÍA 2026-09-17: se unificó la implementación en `lab-reference` para eliminar la copia duplicada
// (que tenía un bug: BP siempre UNKNOWN y TEMP crítico inalcanzable). Aquí solo se re-exporta la ÚNICA
// fuente de verdad, de modo que el test de vitales cubra exactamente el código que corre en producción.
export { classifyVital } from "../../lab-reference/src";
export type { VitalStatus, VitalAssessment } from "../../lab-reference/src";
