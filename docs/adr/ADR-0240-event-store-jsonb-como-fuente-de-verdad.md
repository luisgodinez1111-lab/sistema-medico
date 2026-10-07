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
   proyección materializada solo se introducirá con un evento de reconstrucción y su propio checkpoint, que traerá **su
   propia migración**. La reserva de `projection_checkpoints` queda RETIRADA (auditoría R06-04, migración 0028): eran dos
   tablas de checkpoint vacías y sin código, reservadas para algo que este mismo apartado descarta hasta medir — es decir,
   el artefacto especulativo que la auditoría persigue, no un cimiento.
4. **Las tablas relacionales de dominio no se usan.** Se conservan hasta la limpieza de esquema porque tienen RLS forzada
   (migración 0020) y borrarlas exige una migración destructiva con respaldo verificado; ese trabajo entra en D-02/D-09
   con la decisión del dueño. Ningún código nuevo puede leerlas ni escribirlas.
   Las SEIS tablas heredadas sin lector ni escritor —`release_evidence`, los dos checkpoints de proyección,
   `patient_state_projection` y las dos de break-glass— sí se retiraron, con autorización del dueño, en la migración 0028:
   están renombradas a `*_retirada_0028`, sin privilegios para ningún rol, y su borrado físico queda en manos del dueño.
5. **Reintentos idempotentes con payload derivado del servidor** (barreras de seguridad, hora de firma) reutilizan el
   payload persistido si el `requestDigest` coincide (`replayStablePayload`); un mismo `Idempotency-Key` con otro cuerpo
   es `IDEMPOTENCY_CONFLICT`.
6. **Todo duplicado declara quién manda** (auditoría R06-F11, lote 12e). Para las **tablas**, la declaración vive en el
   catálogo de la base, donde la lee quien la abre: `COMMENT ON TABLE` en las migraciones 0020 (`audit_ledger`,
   `idempotency_keys`, `release_evidence`, `projection_checkpoints`), 0022 (las ajenas al repo), 0026 (`outbox`) y 0027
   (los dos «break glass», los dos recibos de consumidor y `patient_state_projection`). Para los **paquetes** con hermano
   versionado, en `docs/adjudication/duplicate-authority.json`, con un veredicto por miembro —VIGENTE, INVARIANTE o
   SIN_LLAMADOR— que `tests/v22/retired-paths.test.ts` comprueba contra los importadores reales: si alguien cablea un
   paquete declarado sin llamador, o un vigente se queda sin importadores, el build falla. Lo ya retirado se registra en
   `docs/adjudication/retired-paths.json`.

## Alternativas consideradas

1. **Tablas relacionales de dominio como fuente de verdad, con los eventos como bitácora.** Es el modelo que este
   repositorio tenía a medias —de ahí las tablas de proyección de la migración 0002, que quedaron muertas— y se descartó
   porque obliga a mantener dos verdades sobre el mismo hecho clínico: la fila y el evento. Cuando divergen, y divergen,
   no hay criterio para decidir cuál manda. El stream no puede divergir de sí mismo.
2. **Payload con columnas tipadas en vez de `jsonb` con discriminador.** Daría validación en la base, pero cada tipo de
   evento clínico nuevo exigiría una migración de esquema, y hay decenas por vertical. Se descartó a favor de validar el
   payload en el borde (zod) y versionarlo (`schema_version`), que mueve el coste del cambio de la base al código.
3. **Guardar el estado plegado como verdad, recalculándolo solo al escribir.** Más rápido de leer, y se descartó porque
   un fold con un defecto dejaría el estado persistido mal **para siempre**: con el stream como verdad, corregir el fold
   corrige la historia entera al releerla.

## Consecuencias

- Toda regla clínica es reproducible desde el stream; una calculadora no puede "arreglar" datos: solo interpreta eventos.
- El coste es de lectura (folds por petición). Aceptable a la escala actual (consultorio/clínica); medido antes de
  introducir proyecciones.
- Cambiar la forma de un payload exige subir `schema_version` y que el fold entienda ambas versiones. No hay
  migraciones de datos de eventos: son inmutables.
- La cadena de auditoría (`audit_chain_v3`) y el outbox se escriben en la **misma transacción** que el evento
  (ADR-0031 para el outbox; `pnpm audit:verify` recalcula las huellas).
