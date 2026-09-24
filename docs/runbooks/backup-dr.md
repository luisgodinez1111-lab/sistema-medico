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

Una restauración es **aceptable** solo si `restoreErrors()` (`packages/restore-proof`) devuelve vacío. Las dimensiones son
exactamente estas —ni una más— y todas se **calculan** contra la base restaurada:

- **SCHEMA** — el esquema restaurado es idéntico al vivo: columnas, `ENABLE`/`FORCE ROW LEVEL SECURITY`, políticas
  (`pg_policies`, con sus expresiones) y privilegios por rol (`role_table_grants`). Alcance: las tablas que el repo
  **define**; las ajenas que aísla la migración 0022 se reportan aparte (`nonRepoTables*`), porque una base reconstruida
  desde migraciones no puede tenerlas.
- **RLS_WITHOUT_POLICY** — ninguna tabla con RLS se queda sin política: con RLS y sin política una tabla no es «segura»,
  es inservible.
- **MIGRATION_LEDGER** — *qué* esquema se restauró, verificado por hash: el registro `schema_migrations` de la base
  restaurada coincide, migración por migración y por `sha256`, con el del origen y con los ficheros del repo.
- **NON_REPO_TABLES_LOST** — una copia point-in-time no pierde ninguna tabla del origen, ni siquiera el legado que
  ninguna migración crea.
- **AUDIT** — la cadena de auditoría queda encadenada (`previous_hash[n] == entry_hash[n-1]`).
- **RLS** — el aislamiento por tenant se mantiene tras restaurar.
- **REPLAY / OBLIGATIONS** — el replay determinista del stream reproduce el mismo estado (hash puro == persistido). La
  expectativa se **deriva** del constructor del comando: no queda ningún hash escrito a mano en el drill.
- **Reconciliación de recuperación (R005)** — re-aplicar un comando ya aplicado **no duplica** eventos
  (idempotencia por `idempotencyKey`), y un evento faltante se detecta por hueco de secuencia.

> Auditoría R06-F12 (cerrado en el lote 12e): este apartado describía una verificación más fuerte que la que el drill
> ejecutaba —el hash del esquema solo cubría columnas y nada comprobaba qué migraciones llevaba la base restaurada— y, lo
> más grave, **ningún gate ejecutaba el drill**, así que su expectativa del replay llevaba un lote entero desalineada sin
> que nadie pudiera saberlo. Hoy la lista es la del código y el código corre en el gate (§6).

## 4. Procedimiento de restore drill (ENG-055-R002)

**Antes de producción clínica y en cadencia programada:**

1. Crear un **branch/DB desechable** (Neon branch = copia point-in-time = el propio mecanismo de restore).
2. Ejecutar el drill (reconstruye o valida el esquema, corre el stream determinista y verifica todo §3):
   ```bash
   RESTORE_DATABASE_URL=postgres://…<branch desechable> \
     pnpm exec tsx scripts/v22/restore-drill.mts
   ```
   El drill **rehúsa** correr si el target == source (es destructivo). Si el target está vacío, reconstruye el esquema con
   el **migrador versionado** (`pnpm db:migrate up`), no leyendo los `.sql` por su cuenta: así la base restaurada queda con
   su tabla de control `schema_migrations` y `pnpm db:check` es válido sobre ella.
3. **Gate:** `restoreErrors()` debe ser vacío (status `PASS`). Registrar fecha, ventana PITR y RTO medido.
4. El mismo drill corre **en cada gate** contra dos bases desechables locales, sin Neon: ver §6.

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
- **El drill completo, EN EL GATE:** `scripts/v22/live-restore-drill-proof.mts` crea una base objetivo desechable en el
  mismo clúster (nombre único por corrida: el drill es destructivo sobre su target) y ejecuta
  `scripts/v22/restore-drill.mts` de verdad contra ella, sin copiar su lógica. Comprueba las ocho dimensiones de §3 una por
  una, que el objetivo se reconstruyó con el migrador, que registra TODAS las migraciones del repositorio (hoy 28; la prueba deriva la cifra del disco, no la fija a mano) y que **`pnpm db:check` pasa sobre la
  base restaurada**. El smoke lo descubre por disco, así que no hay lista que actualizar.
- **Restore drill contra un branch de Neon:** el mismo `scripts/v22/restore-drill.mts` del §4, que además verifica en ese
  camino que la copia no perdió ninguna tabla (`NON_REPO_TABLES_LOST`).
- **No-false-save:** `tests/v22/downtime-no-false-save.test.ts` (503 en downtime; ningún error → 2xx).

## 7. Lo que este runbook NO cubre

Lo detectó el guardarraíl de R09-033 el día que se escribió: este runbook describía bien lo que hace y no decía nada de sus
límites, y un lector asume cobertura donde solo hay silencio.

- **Los RPO/RTO de §2 son objetivos de diseño, no un compromiso contractual.** Nadie los ha firmado con el proveedor de
  infraestructura y no hay medición histórica de RTO real. Decisión del dueño antes de producción clínica (ADR-0300).
- **La cadencia del drill no está automatizada.** Corre en cada gate contra dos bases desechables locales (§6), lo que
  prueba que el mecanismo funciona; lo que NO hay es una ejecución programada contra un branch PITR de Neon con su registro
  de fecha y RTO medido. Si nadie la lanza a mano, no se lanza.
- **La retención legal no está implementada.** NOM-004 exige conservar el expediente cinco años como mínimo y en la base no
  existe ningún mecanismo de conservación ni de borrado (R06-30, ADR-0280 §Decisiones pendientes). El respaldo protege
  contra la pérdida; no es una política de retención.
- **El borrado por derechos ARCO no existe.** Un respaldo que conserva todo es incompatible con un borrado que debe ser
  efectivo: cómo se reconcilian las dos cosas (criptoborrado, purga, plazos) es una decisión del dueño.
- **No hay verificación de un tercero.** Toda la evidencia de recuperabilidad la produce y la lee el mismo sistema
  (R09-F13); la exposición del informe a un tercero es decisión del dueño.
