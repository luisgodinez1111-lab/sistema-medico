// Presupuesto de seguridad operativa: los indicadores que, si no están en cero, impiden declarar la operación segura.
//
// Auditoría 2026-09-19, anexo R07 (R07-06) — DOS DE LAS CINCO ENTRADAS NO SE EVALUABAN.
//
// El tipo declaraba cinco indicadores y la función solo miraba tres: `deadLetters` y `reconciliationBacklog` viajaban en el
// argumento y NO se comprobaban. Un llamador que pasara 50 cartas muertas recibía `safe:true`. Eso es peor que no tener el
// campo: el nombre promete que se evalúa, y quien lo lee asume que sí. Es el mismo patrón que la función vestigial `isReal`
// del registro de pacientes, pero en un presupuesto de seguridad.
//
// Ahora los cinco bloquean, y cada uno dice por qué:
//   · UNOWNED_CRITICAL — un hallazgo crítico sin responsable asignado no lo va a cerrar nadie.
//   · OVERDUE_CRITICAL — un crítico vencido es, por definición, un seguimiento perdido.
//   · PROJECTION_GAP — una proyección con hueco hace que las listas de trabajo mientan por omisión.
//   · DEAD_LETTER — un mensaje que falló de forma permanente es trabajo clínico que nadie va a reintentar.
//   · RECONCILIATION_BACKLOG — lo que no se ha reconciliado todavía no se sabe si cuadra.
export type SafetyBudget=Readonly<{unownedCritical:number;overdueCritical:number;reconciliationBacklog:number;deadLetters:number;projectionGaps:number}>;
export type SafetyBudgetStatus=Readonly<{safe:boolean;blockers:readonly string[]}>;
/** Razón declarada de cada bloqueador, para que el llamador pueda explicarla sin inventarla. */
export const BUDGET_REASONS:Readonly<Record<string,string>>={
 UNOWNED_CRITICAL:"Hallazgo crítico sin responsable asignado: nadie lo va a cerrar.",
 OVERDUE_CRITICAL:"Hallazgo crítico vencido: es un seguimiento perdido, por definición.",
 PROJECTION_GAP:"Proyección con hueco: las listas de trabajo mienten por omisión.",
 DEAD_LETTER:"Mensaje fallido de forma permanente: trabajo clínico que nadie va a reintentar.",
 RECONCILIATION_BACKLOG:"Rezago de reconciliación: todavía no se sabe si los registros cuadran.",
};
export function budgetStatus(x:SafetyBudget):SafetyBudgetStatus{
 const blockers:string[]=[];
 if(x.unownedCritical>0)blockers.push("UNOWNED_CRITICAL");
 if(x.overdueCritical>0)blockers.push("OVERDUE_CRITICAL");
 if(x.projectionGaps>0)blockers.push("PROJECTION_GAP");
 if(x.deadLetters>0)blockers.push("DEAD_LETTER");
 if(x.reconciliationBacklog>0)blockers.push("RECONCILIATION_BACKLOG");
 return{safe:blockers.length===0,blockers};
}
