# Runbook — Backup, Disaster Recovery y Downtime Mode (ENG-055)

> Autoridad: **ENG-055** (Backup, DR and downtime mode). Endurecimiento eje G, Epic BH (2026-09-17).
> Este runbook es gobierno operativo, no funcionalidad. Verificado por evidencia ejecutable (ver §6).

## 1. Modelo de respaldo (ENG-055-R001)

El almacén de verdad es el **event store append-only** (`clinical_events`) + la **cadena de auditoría
encadenada** (`audit_chain_v3`) en Postgres (Neon en producción). El respaldo se apoya en:

- **PITR (Point-In-Time Recovery)** del proveedor (Neon): restauración a cualquier instante dentro de la
  ventana de retención, mediante *branch* de copia point-in-time.
- **Backups inmutables/segregados**: la retención del proveedor + branches de restauración desechables.
- Naturaleza **event-sourced**: el estado se **deriva** por replay determinista del stream, así que restaurar
  el stream restaura el estado exacto (ver §3, `obligationsMatch`).

## 2. RPO / RTO por flujo (ENG-055-R001)

| Flujo | Criticidad | RPO objetivo | RTO objetivo | Nota |
| --- | --- | --- | --- | --- |
| Firma de encuentro (registro clínico) | Crítico | ≤ 5 min (PITR) | ≤ 30 min | Append-only; nunca se pierde un evento firmado sin estado terminal |
| Ingesta de resultados críticos | Crítico | ≤ 5 min | ≤ 30 min | Closed-loop Zero-Lost-Follow-Up sobrevive al replay |
| Prescripción / medicación | Crítico | ≤ 5 min | ≤ 30 min | Barreras de seguridad son deterministas (no dependen de estado volátil) |
| Obligaciones / seguimiento | Alto | ≤ 15 min | ≤ 60 min | Reconciliación de recuperación detecta faltantes/duplicados |
| Timeline / resumen (lectura) | Medio | ≤ 15 min | ≤ 60 min | Proyección pura; se recomputa del stream |
| Telemetría / SLI | Bajo | best-effort | best-effort | Sin PHI; pérdida tolerable (ENG-054) |

> Los valores son objetivos de diseño; el compromiso contractual se fija con el proveedor de infraestructura
> antes de producción clínica y se revisa en cada *restore drill* (§4).

## 3. Invariantes de recuperabilidad (verificados)

Una restauración es **aceptable** solo si `restoreErrors()` (`packages/restore-proof`) devuelve vacío:

- **SCHEMA** — el esquema restaurado es idéntico al vivo (hash de columnas).
- **AUDIT** — la cadena de auditoría queda encadenada (`previous_hash[n] == entry_hash[n-1]`).
- **RLS** — el aislamiento por tenant se mantiene tras restaurar.
- **REPLAY / OBLIGATIONS** — el replay determinista del stream reproduce el mismo estado (hash puro == persistido).
- **Reconciliación de recuperación (R005)** — re-aplicar un comando ya aplicado **no duplica** eventos
  (idempotencia por `idempotencyKey`), y un evento faltante se detecta por hueco de secuencia.

## 4. Procedimiento de restore drill (ENG-055-R002)

**Antes de producción clínica y en cadencia programada:**

1. Crear un **branch/DB desechable** (Neon branch = copia point-in-time = el propio mecanismo de restore).
2. Ejecutar el drill (reconstruye o valida el esquema, corre el stream determinista y verifica todo §3):
   ```bash
   RESTORE_DATABASE_URL=postgres://…<branch desechable> \
     pnpm exec tsx scripts/v22/restore-drill.mts
   ```
   El drill **rehúsa** correr si el target == source (es destructivo).
3. **Gate:** `restoreErrors()` debe ser vacío (status `PASS`). Registrar fecha, ventana PITR y RTO medido.

## 5. Downtime mode y "nunca guardado en falso" (ENG-055-R003 / R004)

- **Escrituras síncronas fail-closed:** si el almacén está indisponible, el kernel lanza
  `DEPENDENCY_UNAVAILABLE` → HTTP **503**. La app **nunca** devuelve un 2xx ("guardado") ante un fallo o
  indisponibilidad. Enforzado por `tests/v22/downtime-no-false-save.test.ts` (ningún código de error mapea a 2xx).
- **Modo lectura/emergencia:** ante indisponibilidad de escritura, el acceso de **solo lectura** al expediente
  (timeline, resumen, problem list, alergias, medicación activa) se sirve desde proyecciones del stream. Las
  acciones de escritura muestran estado explícito de error/reintento; jamás un "guardado" optimista.
- **Acciones encoladas/temporalmente fallidas** muestran su estado real (pendiente/reintento/fallo), nunca
  "guardado" (R004). La idempotencia (`idempotencyKey` determinista) hace seguro el reintento.

## 6. Evidencia ejecutable

- **En CI (contra postgres:17 desechable):** `scripts/v22/live-dr-recovery-proof.mts` — replay determinista,
  idempotencia anti-duplicado, cadena de auditoría, RLS. Corre en el smoke `live-regression`.
- **Restore drill completo (vs branch de Neon):** `scripts/v22/restore-drill.mts` (schema + audit + RLS + replay).
- **No-false-save:** `tests/v22/downtime-no-false-save.test.ts` (503 en downtime; ningún error → 2xx).
