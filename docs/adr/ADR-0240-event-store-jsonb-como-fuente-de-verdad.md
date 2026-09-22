# ADR-0240 — Event store en `clinical_events.payload` (jsonb) como única fuente de verdad clínica
Status: ACEPTADO (2026-09-22) — documenta una decisión que el código tomó desde el 15-sep-2026 (auditoría G-07)

## Contexto

El esquema nació con dos modelos en paralelo: tablas relacionales por dominio (`patients`, `encounters`,
`diagnostic_results`, `medications`, `obligations`, `audit_ledger`, `idempotency_keys`; migraciones 0001–0002) y un
stream de eventos (`clinical_events`). Todo el runtime real (kernel `atomic-clinical-transaction-v3`, folds, lecturas de
`apps/web/lib/clinical-runtime.ts`) escribe y lee **solo** el stream; las tablas relacionales de dominio no tienen
ningún lector ni escritor en producción. La auditoría del 19-sep lo señaló como "tablas relacionales muertas" y como
riesgo: dos modelos sin decidir cuál manda.

## Decisión

1. **La verdad clínica es el stream.** Un agregado (paciente, encuentro, medicación, problema, resultado, obligación,
   documento…) es la secuencia `clinical_events` con `(tenant_id, aggregate_id, sequence)` única; su estado actual es
   el **fold puro** del paquete correspondiente (`packages/*-fold`, `packages/*-lifecycle`). Nunca se guarda estado
   derivado como verdad: se recalcula.
2. **El payload es jsonb con discriminador `kind`** y `schema_version` por evento. Los eventos de ciclo de vida cambian
   el estado; los de **anotación** (MODIFIED, RECONCILED, EPISTEMIC_CHANGED, EVIDENCE_UPDATED, CREDENTIALS_SET…) lo
   enriquecen sin cambiarlo (lote 4 y siguientes). Los folds deben tolerar eventos que no conocen del mismo agregado
   solo si son anotaciones declaradas; un `kind` desconocido es `INVARIANT_VIOLATION` (fail-closed).
3. **Lecturas por consulta SQL sobre jsonb**, no por proyecciones materializadas. Los índices necesarios viven en
   migraciones (`0019_event_store_read_indexes.sql`: `payload->>'patientId'`, tipo de agregado, `occurred_at`). Una
   proyección materializada solo se introducirá con un evento de reconstrucción y su propio checkpoint (hoy no existe;
   `projection_checkpoints` está reservada).
4. **Las tablas relacionales de dominio no se usan.** Se conservan hasta la limpieza de esquema porque tienen RLS forzada
   (migración 0020) y borrarlas exige una migración destructiva con respaldo verificado; ese trabajo entra en D-02/D-09
   con la decisión del dueño. Ningún código nuevo puede leerlas ni escribirlas.
5. **Reintentos idempotentes con payload derivado del servidor** (barreras de seguridad, hora de firma) reutilizan el
   payload persistido si el `requestDigest` coincide (`replayStablePayload`); un mismo `Idempotency-Key` con otro cuerpo
   es `IDEMPOTENCY_CONFLICT`.

## Consecuencias

- Toda regla clínica es reproducible desde el stream; una calculadora no puede "arreglar" datos: solo interpreta eventos.
- El coste es de lectura (folds por petición). Aceptable a la escala actual (consultorio/clínica); medido antes de
  introducir proyecciones.
- Cambiar la forma de un payload exige subir `schema_version` y que el fold entienda ambas versiones. No hay
  migraciones de datos de eventos: son inmutables.
- La cadena de auditoría (`audit_chain_v3`) y el outbox se escriben en la **misma transacción** que el evento
  (ADR-0031 para el outbox; `pnpm audit:verify` recalcula las huellas).
