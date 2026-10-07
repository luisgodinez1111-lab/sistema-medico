# ADR-0031 — Clinical Events + Transactional Outbox
Status: ACCEPTED


> **Encabezado de gobierno añadido el 2026-10-06 (auditoría R09-003).** El ADR original no declaraba fecha, autor ni
> alternativas. Lo que sigue se DERIVA de evidencia verificable o se declara ausente; **nada se reconstruye de memoria**:
> inventar una fecha de decisión o un decisor sería fabricar un registro de gobierno, que es justo el defecto que esta
> auditoría persigue en otros sitios (la tabla de firmas C5 vacía, `Mapping_Adjudication.csv` con cero filas).
>
> · **Fecha de incorporación al repositorio:** 2026-09-15 (del historial de git, `--diff-filter=A`). **No es la fecha de la
>   decisión**, que no consta en ninguna parte.
> · **Decidido por:** **no consta.** El repositorio registra quién hizo el commit, no quién tomó la decisión, y son cosas
>   distintas. Lo llena el dueño del producto; hasta entonces este ADR documenta una decisión sin decisor registrado.
> · **Alternativas consideradas:** Escritura dual (base + broker) sin outbox transaccional — el texto la descarta por la pérdida de atomicidad entre el evento y su publicación.

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
