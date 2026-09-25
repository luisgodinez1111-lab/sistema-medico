// Consumidores del outbox: quién recibe cada mensaje publicado por el kernel. Puro, sin PHI (recibe tema y payload de evento).
//
// Auditoría 2026-09-19, anexos R06 y R09 (R06-27, R06-F16, R09-002) — UNA COLA QUE NADIE LEE Y QUE SOLO CRECE.
//
// Medido el 25-sep-2026: **todos** los comandos clínicos insertan una fila en `outbox` con estado `PENDING`
// (`packages/atomic-clinical-transaction-v3`), y NADA la drena. No hay un solo llamador del claim en el repositorio. El rol
// `medical_os_worker` existe desde la migración 0016 con `SELECT, UPDATE` sobre `outbox` —el permiso está— y el comentario de
// `db/roles_v16.sql` lo dice sin rodeos: «el consumidor del outbox (aún no construido: D-03/R06-27)». ADR-0031 promete un
// outbox reconciliable; lo que había era la promesa y las piezas puras, no el mecanismo.
//
// EL PUNTO QUE ESTE MÓDULO EXISTE PARA NO CRUZAR: no se fabrica una entrega. Marcar `DELIVERED` un mensaje que nadie
// consumió sería el mismo defecto que el antivirus inventado de R2B-011 —una afirmación falsa en un registro append-only—,
// con el agravante de que borraría el rastro de la única cosa que hoy es cierta: que el mensaje sigue pendiente. Por eso el
// registro de consumidores está VACÍO y el drenado lo dice en vez de vaciar la cola.
export type OutboxMessage=Readonly<{
 id:string;tenantId:string;topic:string;aggregateId:string;payload:unknown;attempts:number;maxAttempts:number;
}>;
/** Resultado de entregar un mensaje a un consumidor. Un fallo se declara, no se traga. */
export type DeliveryOutcome=
 |Readonly<{status:"DELIVERED"}>
 |Readonly<{status:"FAILED";error:string}>;
export type OutboxConsumer=Readonly<{
 /** Identificador estable: es la clave del recibo en `outbox_consumer_receipts`, así que cambiarlo reprocesa todo. */
 name:string;
 /** Temas que consume. Un prefijo con `*` al final cubre una familia («patient.*»). */
 topics:readonly string[];
 deliver:(m:OutboxMessage)=>Promise<DeliveryOutcome>;
}>;

export function consumerHandles(c:OutboxConsumer,topic:string):boolean{
 return c.topics.some(t=>t.endsWith("*")?topic.startsWith(t.slice(0,-1)):t===topic);
}

/**
 * Consumidores registrados. **Está vacío a propósito y eso es el estado honesto del sistema hoy.**
 *
 * El outbox publica temas como `surgery.timeout_completed` o `patient.registered`, y hoy NADIE se suscribe: la proyección de
 * estado del paciente y los puntos de control de proyección se retiraron en la migración 0028 al comprobarse que no tenían
 * lector. Añadir aquí un consumidor es una decisión de producto —qué se integra: un portal, una mensajería, un sistema de
 * facturación— y mientras no exista, el drenado NO vacía la cola: informa de que no hay a quién entregar.
 *
 * Consecuencia declarada: `outbox` crece con cada comando. Es visible —`budgetStatus` cuenta el rezago de reconciliación y
 * los mensajes muertos— y esa visibilidad es el comportamiento correcto mientras no haya consumidor, porque la alternativa
 * (marcarlos entregados) sería mentir en el registro.
 */
export const OUTBOX_CONSUMERS:readonly OutboxConsumer[]=[];

export const OUTBOX_CONSUMERS_NOTE=
 "El registro de consumidores del outbox está vacío: hoy ningún sistema se suscribe a los temas que el kernel publica. El "+
 "drenado NO marca entregado lo que nadie consumió —eso sería una afirmación falsa en un registro append-only— y por tanto "+
 "la cola crece. El rezago es visible en el presupuesto de seguridad operacional. Registrar el primer consumidor es una "+
 "decisión de producto (qué se integra), no una deuda de ingeniería.";
