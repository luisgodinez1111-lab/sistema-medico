# Runbook — migraciones de base de datos (`pnpm db:migrate`)

Auditoría 2026-09-19, hallazgos P-06 y D-08. Antes de este runbook el esquema de producción se migraba a mano y no
había forma de saber si coincidía con el repo.

## Qué hace

- `db/migrations/NNNN_nombre.sql`, en orden, una sola vez cada una, con tabla de control `schema_migrations`
  (versión, fichero, sha256, cuándo, quién, nota).
- Cada migración pendiente se aplica en **una transacción** junto con su fila de control: o entra completa o no entra.
- Las migraciones ya aplicadas se comparan por sha256 con el fichero del repo. Si alguien editó una migración aplicada,
  es **deriva**: el migrador se detiene y no aplica nada (las migraciones aplicadas no se editan; se escribe una nueva).
- `db/migrations/manifest.json` lista TODAS las migraciones con su sha256; `tests/v22/migrations-integrity.test.ts`
  falla si el manifiesto no coincide con los ficheros. Al añadir una migración: `pnpm db:manifest`.

## Comandos

```
pnpm db:migrate -- status                        # aplicadas / pendientes / deriva; no modifica nada
pnpm db:migrate -- up [--yes]                    # aplica las pendientes (--yes obligatorio si el host no es local)
pnpm db:migrate -- baseline --through NNNN --yes # registra como aplicadas, SIN ejecutar, las que la base ya lleva
```

`DATABASE_URL` debe ser el **rol propietario** del esquema y el host **directo** (el migrador quita `-pooler`).

## Primera vez en producción (base migrada a mano hasta 0018)

1. Copia de seguridad / punto de restauración de la rama de Neon.
2. `pnpm db:migrate -- status` → mostrará 20 pendientes (no hay tabla de control todavía).
3. `pnpm db:migrate -- baseline --through 0018 --yes` → registra 0001–0018 sin ejecutarlas. El migrador **rechaza** el
   baseline si falta alguna de las tablas que esas migraciones crean (la afirmación sería falsa).
4. `pnpm db:migrate -- up --yes` → aplica `0019` (índices de lectura) y `0020/0021` (políticas RLS faltantes, tablas heredadas).
5. `pnpm db:migrate -- status` → `pending: []`, `drift: []`.

## CI y pruebas en vivo

`scripts/ci/bootstrap-db.mts` crea los roles y llama a `db:migrate up` contra el contenedor desechable: el mismo camino
que producción. Las pruebas en vivo (`scripts/v22/live-*-proof.mts`) exigen `TEST_DATABASE_URL` y se niegan a correr
contra la base de la aplicación (`scripts/v22/_live-env.mts`).

## Reglas

- Nunca editar una migración aplicada (D-07). Nunca `CREATE INDEX CONCURRENTLY` (no cabe en la transacción).
- Cada migración lleva su porqué en comentarios y, si corrige un hallazgo de auditoría, su ID.
