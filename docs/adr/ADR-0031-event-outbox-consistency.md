# ADR-0031 — Clinical Events + Transactional Outbox
Status: ACCEPTED

Clinically consequential state changes use transactional state + outbox semantics. Async consumers are idempotent. Partial delivery is detectable, retryable, reconcilable, and dead-lettered rather than silently lost.


## Addendum 2026-09-22 — estado real (auditoría del 19-sep-2026, hallazgo D-03)

**Hecho:** el kernel atómico escribe una fila en `outbox` por cada comando (misma transacción que el evento y la
auditoría), pero **no hay ningún consumidor desplegado**: las tres implementaciones de *claim* no tienen llamador, el rol
de la aplicación no tiene `UPDATE` sobre `outbox`, y `apps/worker` era un módulo sin bucle que `infra/compose.yaml`
arrancaba con `node` sobre un `.ts`. Los eventos se acumulaban sin consumidor.

**Decisión:** el outbox se conserva como **cola reservada**: escribirla cuesta nada, mantiene la garantía de que todo
comando deja un mensaje entregable, y el día que exista un consumidor real (notificación de resultado crítico,
proyección externa) no habrá que tocar el kernel. Mientras tanto:

- No se despliega ningún "worker" de mentira; `compose.yaml` ya no lo declara.
- La cola tiene **retención**: `pnpm outbox:purge --older-than-days N --yes` (rol propietario) borra mensajes
  `PENDING` más antiguos que N días. Es seguro porque en este sistema los consumidores reconstruyen desde
  `clinical_events` (la fuente de verdad), no desde el outbox.
- Un consumidor futuro deberá: reclamar bajo el contexto de su tenant (RLS), ser idempotente por `eventId`, y registrar
  recibo en `outbox_consumer_receipts` (append-only). Ese consumidor recibe `UPDATE` sobre `outbox` en su migración, no antes.

Este addendum sustituye la frase "Async consumers are idempotent" como descripción del estado actual: hoy no hay
consumidores; la propiedad se exige al primero que exista.
