export type ObligationState="OPEN"|"SCHEDULED"|"IN_PROGRESS"|"WAITING_EXTERNAL"|"OVERDUE"|"ESCALATED"|"COMPLETED"|"CANCELLED"|"FAILED";
export type Obligation=Readonly<{id:string;patientId:string;ownerId:string;dueAt:string;state:ObligationState;version:number;completionEvidence?:string}>;
export function completeObligation(o:Obligation,evidence:string){if(!evidence)throw new Error("COMPLETION_EVIDENCE_REQUIRED");if(["COMPLETED","CANCELLED"].includes(o.state))throw new Error("OBLIGATION_TERMINAL");return Object.freeze({...o,state:"COMPLETED" as const,version:o.version+1,completionEvidence:evidence});}
export function detectOverdue(o:Obligation,now:string){if(["COMPLETED","CANCELLED"].includes(o.state))return o;if(Date.parse(now)>Date.parse(o.dueAt))return Object.freeze({...o,state:"OVERDUE" as const,version:o.version+1});return o;}

// ============================================================================================================
// Auditoría 2026-09-19, anexo R05a (R05a-F04 / WS1-10) — EL PLAZO DEL SEGUIMIENTO SE DERIVA EN EL SERVIDOR,
// por severidad y tipo, nunca de una constante del navegador.
//
// EL HALLAZGO, con la contradicción que se encontró al cablearlo. La pantalla enviaba `dueAt = ahora + 7 días` para
// CUALQUIER resultado que pasara a «requiere acción», incluido un potasio de 7.0 mEq/L; y el mismo servidor, al RECIBIR ese
// resultado, ya había abierto una obligación URGENTE con plazo de 24 h (`CRITICAL_RESULT_REVIEW`, auditoría C-20). El mismo
// resultado crítico quedaba en el expediente con DOS vencimientos distintos —24 h en la obligación, 7 días en el evento del
// resultado— y el que decidía el navegador era el más largo. Encima, siendo una constante de cliente, cualquier cliente
// podía declarar el plazo que quisiera: el servidor aceptaba la fecha sin mirarla.
//
// QUÉ SE DECLARA AQUÍ. El plazo POR OMISIÓN y, donde la severidad lo exige, el TECHO. No son recomendaciones clínicas y no
// se presentan como tales: el médico siempre puede fijar una fecha MÁS PRÓXIMA —y el sistema la respeta—; lo que el servidor
// no acepta es una MÁS LEJANA que la que corresponde a algo declarado urgente. El único número con anclaje dentro de este
// repositorio es el de 24 h del resultado crítico, que ya estaba aplicado en `result-lifecycle`; los demás son decisiones
// operativas declaradas, no normas, y están listadas en ADR-0300 para que el responsable clínico las confirme o las cambie.
//
// POR QUÉ SE RECORTA Y NO SE RECHAZA CON 400. Rechazar dejaría el resultado crítico SIN la acción registrada —el médico ve
// un error, el lazo de seguimiento no se abre y el paciente queda sin responsable ni fecha—, que es peor para el paciente
// que registrar la acción con el plazo correcto. El evento guarda además la fecha PEDIDA y la marca de recorte: el registro
// es de solo-añadir y tiene que decir lo que de verdad pasó, no solo el resultado.
//
// POR QUÉ SE DERIVA DE `occurredAt` Y NO DEL RELOJ. El plazo forma parte del payload del comando, y el kernel exige que un
// reintento con la misma Idempotency-Key produzca el MISMO payload. Derivarlo de `Date.now()` haría que cada reintento
// calculara una fecha distinta y el comando dejaría de ser idempotente.
// DOS COSAS DISTINTAS, que es la corrección que este hallazgo necesitaba de verdad:
//   · `defaultHours` — el plazo que se aplica cuando NADIE pidió uno. Sustituye a la constante del navegador.
//   · `maxHours`     — el TECHO, y solo existe donde la severidad lo exige. Es `null` para lo rutinario: un seguimiento de
//     rutina puede tener horizonte largo y legítimo —«solicitar HbA1c en 3 meses», o las propias reglas de monitoreo de este
//     repositorio, que llegan a 90 y 180 días (ACOD: función renal cada 180)—. Poner techo a lo rutinario convertiría
//     seguimientos correctos en tareas VENCIDAS, que es exactamente el ruido que esta auditoría persigue en otros hallazgos:
//     una lista de pendientes falsos desplaza al pendiente real.
export type FollowUpPriority="URGENT"|"HIGH"|"ROUTINE";
/** Plazo de un seguimiento: por omisión, techo (si la severidad lo exige) y la razón de ambos. */
export type DueWindow=Readonly<{priority:FollowUpPriority;defaultHours:number;maxHours:number|null;basis:string}>;
const HORA_MS=3_600_000;
/** Plazos por PRIORIDAD, para los tipos de obligación que no declaran el suyo. */
export const PRIORITY_DUE_WINDOWS:Readonly<Record<FollowUpPriority,DueWindow>>={
 URGENT:{priority:"URGENT",defaultHours:24,maxHours:24,
  basis:"URGENTE = mismo día. Las 24 h son el plazo que este sistema YA aplicaba al resultado crítico (obligación CRITICAL_RESULT_REVIEW, auditoría C-20), y una obligación urgente vencida bloquea la firma del encuentro: admitir un plazo más largo para algo declarado urgente contradiría ese bloqueo. Aquí el techo SÍ aplica."},
 HIGH:{priority:"HIGH",defaultHours:72,maxHours:72,
  basis:"ALTA = dentro de la semana laboral. Las 72 h son una decisión OPERATIVA de este sistema, no una norma citada: acotan lo que no es una emergencia pero no puede esperar a la revisión de rutina. Pendiente de confirmación del responsable clínico (ADR-0300)."},
 ROUTINE:{priority:"ROUTINE",defaultHours:24*7,maxHours:null,
  basis:"RUTINA = 7 días POR OMISIÓN, que es exactamente lo que el navegador venía enviando: se conserva para no cambiar el significado de lo ya registrado. SIN techo, y a propósito: «HbA1c en 3 meses» o «función renal en 6 meses» son plazos rutinarios legítimos —el catálogo de monitoreo de este repositorio los usa— y recortarlos los convertiría en tareas vencidas el mismo día."},
};
/** Plazos declarados por TIPO de obligación. Cada uno con la razón de su plazo. Gana sobre el de la prioridad: es la decisión más específica. */
export const OBLIGATION_DUE_WINDOWS:Readonly<Record<string,DueWindow>>={
 CRITICAL_RESULT_REVIEW:{priority:"URGENT",defaultHours:24,maxHours:24,
  basis:"Un valor de pánico exige contactar al paciente y actuar el mismo día. Es el plazo que ya aplicaba `createCriticalResultObligation` al recibir el resultado: declarándolo aquí, la obligación urgente y el evento del propio resultado dejan de poder decir fechas distintas para el MISMO resultado crítico, que es el defecto que encontró esta auditoría."},
 // Auditoría 2026-09-19, anexo R02a (R02a-IMG-01) — HALLAZGO CRÍTICO DE IMAGEN.
 //
 // Un resultado de laboratorio crítico creaba su obligación urgente desde el primer día; un hallazgo crítico de IMAGEN no
 // creaba nada. Un neumotórax a tensión o una hemorragia intracraneal se reportaban en el informe y, si nadie leía ese
 // informe, no quedaba ningún pendiente que lo persiguiera: un agujero de Zero-Lost-Follow-Up en una vertical entera.
 //
 // Mismo plazo que el valor de pánico de laboratorio, y por la misma razón: un hallazgo que exige acción inmediata no
 // puede esperar más que el día en que se encontró. Se declara aparte en vez de reutilizar la clave del laboratorio
 // porque el origen importa —el gate de firma y la bitácora distinguen de qué vino el pendiente— y porque el techo de un
 // hallazgo de imagen podría divergir del de un analito sin que nadie lo note si compartieran la entrada.
 CRITICAL_IMAGING_REVIEW:{priority:"URGENT",defaultHours:24,maxHours:24,
  basis:"Un hallazgo de imagen que exige acción inmediata (neumotórax, hemorragia, perforación) se trata el mismo día. Mismo plazo que el valor de pánico de laboratorio (CRITICAL_RESULT_REVIEW): la urgencia la define la consecuencia clínica, no la técnica con que se detectó."},
 MONITORING_UNDEFINED:{priority:"HIGH",defaultHours:24*7,maxHours:null,
  basis:"Definir qué vigilar en un fármaco fuera del catálogo no es una emergencia, pero tampoco puede quedarse abierto: 7 días es el plazo que ya aplicaba `createMonitoringObligations`, ahora declarado en un solo lugar en vez de escrito dentro del ciclo de vida de la medicación. Sin techo porque la obligación la crea el servidor con su propio plazo; el techo no tendría a quién recortar."},
};
/** Plazo aplicable a un seguimiento: el declarado para ese TIPO si existe (decisión más específica), y si no el de la PRIORIDAD. */
export function dueWindowFor(kind:string,priority:FollowUpPriority):DueWindow{
 return OBLIGATION_DUE_WINDOWS[kind.trim().toUpperCase()]??PRIORITY_DUE_WINDOWS[priority];
}
/** Fecha del plazo POR OMISIÓN, derivada del HECHO (`occurredAt`) y no del reloj: un reintento produce la misma fecha. */
export function dueAtFrom(occurredAt:string,w:DueWindow):string{
 const t=Date.parse(occurredAt);
 if(!Number.isFinite(t))throw new Error("OCCURRED_AT_INVALID");
 return new Date(t+w.defaultHours*HORA_MS).toISOString();
}
/** Qué plazo queda y si hubo que recortar el pedido. `requested` es null cuando el cliente no pidió ninguno. */
export type DueDecision=Readonly<{dueAt:string;window:DueWindow;clamped:boolean;requested:string|null}>;
export function decideDueAt(occurredAt:string,requested:string|undefined,w:DueWindow):DueDecision{
 const porOmision=dueAtFrom(occurredAt,w);
 if(requested===undefined||requested==="")return{dueAt:porOmision,window:w,clamped:false,requested:null};
 const r=Date.parse(requested);
 // Una fecha ilegible no aborta el seguimiento: se abre con el plazo por omisión y queda anotado el texto recibido.
 if(!Number.isFinite(r))return{dueAt:porOmision,window:w,clamped:true,requested};
 const pedida=new Date(r).toISOString();
 if(w.maxHours===null)return{dueAt:pedida,window:w,clamped:false,requested};
 const techo=new Date(Date.parse(occurredAt)+w.maxHours*HORA_MS).toISOString();
 // Se respeta lo pedido si es IGUAL O MÁS PRÓXIMO que el techo; nunca más lejano.
 return r<=Date.parse(techo)?{dueAt:pedida,window:w,clamped:false,requested}:{dueAt:techo,window:w,clamped:true,requested};
}
/** Lo que se escribe en el evento: la fecha efectiva y, si se recortó, la pedida y el techo que la recortó. */
export function dueAtPayload(d:DueDecision):Record<string,unknown>{
 if(!d.clamped)return{dueAt:d.dueAt};
 return{dueAt:d.dueAt,dueAtRequested:d.requested,dueAtClamped:true,dueAtMaxHours:d.window.maxHours};
}
