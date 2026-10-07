# ADR-0250 — PostgreSQL (Neon) con postgres.js, rol `medical_os_runtime` NOBYPASSRLS y RLS forzada por tenant
Status: ACEPTADO (2026-09-22) — documenta la decisión vigente en el código (auditoría G-07; D-01/D-04 del lote 7)


> **Decidido por:** la remediación de la auditoría del 19-sep-2026, bajo la autorización del dueño del repositorio. El
> lote que lo introdujo y su hash están en `docs/reviews/2026-09-20-remediacion-auditoria.md`, así que la decisión es
> **rastreable a un cambio concreto** — a diferencia de los 25 ADR heredados, cuyo decisor no consta en ninguna parte.
> **Alternativas consideradas:** las que el apartado «Decisión» descarta explícitamente más abajo.

## Contexto

Multi-tenant con PHI: el aislamiento entre clínicas no puede depender de que cada consulta recuerde un `WHERE
tenant_id = …`. Neon expone dos endpoints (directo y `-pooler` con PgBouncer en modo transacción) y su usuario
propietario tiene `BYPASSRLS`, con lo que un pool que corra como propietario **ignora** RLS sin avisar (lección de la
sesión del 15-sep).

## Decisión

1. **Cliente:** `postgres` (postgres.js), sin ORM. SQL explícito y revisable; sentencias preparadas activas.
2. **Rol de ejecución:** todo el pool de la aplicación asume `medical_os_runtime` (NOBYPASSRLS, sin `UPDATE`/`DELETE`
   sobre eventos y auditoría) mediante la opción de arranque de conexión `-c role=medical_os_runtime`. El usuario
   conector solo necesita `GRANT medical_os_runtime` (bootstrap en `scripts/ci/bootstrap-db.mts`, roles en
   `db/roles_v16.sql`).
3. **Endpoint directo**, no el pooler: PgBouncer en modo transacción no admite parámetros de arranque. Para no agotar
   conexiones, `max: 5` por instancia y `idle_timeout` corto; Fluid Compute reutiliza instancias. Trade-off aceptado y
   medido antes de cambiar a un modelo pooled RLS-aware (p. ej. `SET ROLE` por transacción sobre el pooler).
4. **RLS forzada en TODAS las tablas con `tenant_id`** (`ENABLE` + `FORCE ROW LEVEL SECURITY`) con política
   `tenant_id = app.current_tenant()` en `USING` y `WITH CHECK`; el tenant se fija con `set_config('app.tenant_id', …,
   true)` **dentro de cada transacción** junto con actor, propósito y request id. Una tabla con `tenant_id` sin RLS
   forzada hace fallar `pnpm db:check` (D-06/D-08).
5. **Kernel transaccional único** (`executeAtomicClinicalCommand`): evento + idempotencia + auditoría encadenada +
   outbox en una transacción; el `actor_type` (HUMAN/AI/SYSTEM) viene del contexto verificado, no del cuerpo.
6. **Migraciones versionadas** con tabla de control `schema_migrations`, sha256 por fichero y detección de deriva
   (`pnpm db:migrate`, runbook `docs/runbooks/db-migrate.md`). Nada se aplica "a mano" fuera del migrador.

## Consecuencias

- Un fallo de configuración (pool como propietario) rompería el aislamiento: `scripts/v22/live-rls-*-proof.mts` y
  `live-tenant-*` lo verifican contra Postgres real en cada regresión en vivo; no basta con vitest.
- Las pruebas en vivo exigen `TEST_DATABASE_URL` y se niegan a usar el host de `DATABASE_URL` (P-07).
- El límite de conexiones del endpoint directo es la primera restricción de escala conocida; está documentado aquí y en
  `clinical-runtime.ts`, no oculto.
