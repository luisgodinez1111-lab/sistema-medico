# Medical OS — sistema médico general (expediente clínico electrónico)

Sistema clínico multi-especialidad, multi-tenant, con núcleo **event-sourced** sobre PostgreSQL (Neon en producción),
API HTTP en Next.js (App Router, runtime Node.js) y un cockpit clínico en React. No es un producto terminado: el estado
real de cada capacidad, sus deudas y lo que solo puede decidir el dueño están en
[`docs/reviews/2026-09-20-remediacion-auditoria.md`](docs/reviews/2026-09-20-remediacion-auditoria.md).

> Contenido clínico (interacciones, techos de dosis, escalas, rangos por edad…) **pendiente de validación por un médico**
> antes de uso asistencial. Cada regla cita su fuente en el código y en sus tests.

## Arquitectura en una página

| Capa | Dónde | Qué hace |
|---|---|---|
| Kernel clínico | `packages/atomic-clinical-transaction-v3`, `db/migrations` | Un comando = una transacción: evento en `clinical_events` (`payload` jsonb), idempotencia (`command_idempotency`), cadena de auditoría (`audit_chain_v3`, append-only) y outbox. RLS forzada por tenant (`app.current_tenant()`). |
| Folds / dominio | `packages/*-fold`, `packages/prescription-safety`, `packages/lab-reference`, `packages/drug-catalog`… | Puros y deterministas: estado a partir del stream de eventos; barreras de seguridad de prescripción; calculadoras clínicas. Sin E/S ni PHI en mensajes. |
| Handlers HTTP | `apps/web/lib/*-lifecycle.ts`, `apps/web/app/api/v1/**` | Autenticación (OIDC + sesión HMAC en cookie `medos_session`), autorización por rol y scope, `Idempotency-Key` + `If-Match`, errores fail-closed (`apps/web/lib/http-errors.ts`). |
| Interfaz | `apps/web/app/workspace/page.tsx` | Cockpit clínico (consulta, expediente, medicación con barreras, resultados, seguimiento, configuración). |
| Gobierno de seguridad | `packages/clinical-safety`, `safety/`, `capabilities/`, `release/` | Registro de invariantes y peligros, admisión de release (`pnpm release:check`), trazabilidad de tests (`pnpm traceability:check`). |
| Operación | `scripts/db`, `scripts/ops`, `docs/runbooks` | Migrador con tabla de control y detección de deriva, verificación de la cadena de auditoría, retención del outbox. |

Decisiones de arquitectura: [`docs/adr/`](docs/adr/) (las reales del código: ADR-0230 y siguientes).

## Requisitos

- Node.js 22 y **pnpm 10.15** (`corepack enable` lo instala desde `packageManager`).
- PostgreSQL 16+ (local para desarrollo; Neon en producción). No hace falta Docker; hay un `infra/compose.yaml` opcional.

## Arranque local (desarrollo)

```bash
corepack enable && pnpm install --frozen-lockfile
cp .env.example .env.local            # y edita los valores (ver "Variables de entorno")

# Base de datos DESECHABLE de desarrollo (roles + migraciones con el migrador real):
#   con Docker:  docker compose -f infra/compose.yaml up -d postgres
#   sin Docker:  initdb/pg_ctl locales; ver docs/runbooks/db-migrate.md
export DATABASE_URL='postgres://<superusuario>@127.0.0.1:5432/medical_os' CI_DB_BOOTSTRAP_ALLOW=1
pnpm exec tsx scripts/ci/bootstrap-db.mts      # crea medical_os_runtime y aplica db/migrations/0001..N
pnpm db:check                                  # manifiesto ↔ ficheros, RLS, políticas, deriva

# Aplicación
pnpm exec next dev apps/web                    # http://localhost:3000/login
```

Sin un IdP OIDC configurado, el inicio de sesión de desarrollo usa el verificador "dev" (`AUTH_MODE=development`,
`ALLOW_DEV_IDENTITY=1`, `DEV_IDENTITY_SECRET`); está deshabilitado por código en producción. No existen datos semilla:
el primer paciente se registra desde la UI o con `POST /api/v1/patients`.

## Verificación (lo mismo que corre CI)

```bash
pnpm typecheck && pnpm typecheck:web     # TypeScript estricto (raíz y apps/web)
pnpm test                                # vitest (unitarias + render jsdom + contratos de trazabilidad)
pnpm traceability:check && pnpm release:check
pnpm openapi:check                       # docs/api/openapi.json generada desde las rutas reales (pnpm openapi:generate)
pnpm build:web
# Regresión de integración REAL (93 pruebas en vivo) — SOLO contra una base desechable:
export TEST_DATABASE_URL='postgres://...base_desechable...' SESSION_SIGNING_SECRET=cualquiera NODE_ENV=test
pnpm exec tsx scripts/ci/live-smoke.mts
```

Las pruebas en vivo se niegan a correr contra la base de la aplicación (`scripts/v22/_live-env.mts`). Toda prueba que
prescriba o firme registra antes la cédula profesional sintética del médico (`scripts/v22/_physician-credentials.mts`).

## Variables de entorno

Solo se leen las siguientes (el resto de nombres son deriva y se pueden borrar). Nunca se escriben valores en el código.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión de la aplicación (rol conector con `SET ROLE medical_os_runtime`). |
| `TEST_DATABASE_URL` | Base **desechable** para las pruebas en vivo; obligatoria para ellas. |
| `SESSION_SIGNING_SECRET` | Secreto HMAC de la sesión clínica. Sin él la API falla cerrada. |
| `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URI`, `OIDC_TENANT_CLAIM`, `OIDC_ROLES_CLAIM`, `OIDC_SCOPES_CLAIM` | Verificador OIDC real (Auth0/SSO). Con issuer + audience tiene prioridad y es el único válido en producción. |
| `NEXT_PUBLIC_AUTH0_DOMAIN`, `NEXT_PUBLIC_AUTH0_CLIENT_ID`, `NEXT_PUBLIC_OIDC_AUDIENCE` | Login SPA (públicas). El dominio entra en la CSP en build. |
| `AUTH_MODE`, `ALLOW_DEV_IDENTITY`, `DEV_IDENTITY_SECRET` | Verificador de identidad de **desarrollo**; ignorado en producción. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob privado (firma/sello del médico, adjuntos de documentos). |
| `ENABLE_HOSPITAL_VERTICALS` | Verticales hospitalarias (transfusión, cirugía, diálisis, triage, admisión, muestras, heridas). `false` por defecto: 404. |
| `AI_COPILOT_ENABLED`, `AI_COPILOT_SHADOW` | Puerta del copiloto de IA (apagado; R6 en pausa) y modo sombra. |
| `OBSERVABILITY_EMIT` | `1` escribe eventos SLI en stdout (no hay exportador). |
| `CI_DB_BOOTSTRAP_ALLOW`, `LIVE_PROOF_ALLOW_SHARED_DB`, `RESTORE_DATABASE_URL` | Guardas de scripts destructivos (bootstrap, pruebas en vivo, simulacro de restauración). |
| `NODE_ENV`, `VERCEL_ENV` | Los pone la plataforma. |

## Operación

- Migraciones: `pnpm db:migrate -- status|up|baseline` (tabla `schema_migrations`, sha256 por migración, `--yes` fuera de
  local). Runbook: [`docs/runbooks/db-migrate.md`](docs/runbooks/db-migrate.md).
- Cadena de auditoría: `pnpm audit:verify` recalcula cada huella en la base y detecta alteraciones.
- Retención de PHI: `pnpm phi:retention -- --tenant <uuid>` informa (solo lectura) qué expedientes superaron la retención
  (ADR-0280; la purga exige decisiones del dueño).
- Outbox: no hay consumidor desplegado; retención con `pnpm outbox:purge -- --older-than-days N --yes` (ADR-0031, addendum).
- API: `docs/api/openapi.json` (OpenAPI 3.1) se genera desde el inventario real de rutas con `pnpm openapi:generate`;
  CI falla si está desfasada. Los cuerpos se validan con zod en cada handler (esquemas JSON por exportar).
- Despliegue: `main` → Vercel (build `next build apps/web`). Imagen propia con el `Dockerfile` (ver abajo).

## Docker (self-hosted)

```bash
docker build -t medical-os-web .
docker run --rm -p 3000:3000 --env-file .env.production medical-os-web
```

La imagen compila `apps/web` en modo `standalone` y arranca `node apps/web/server.js` como usuario sin privilegios.
Las migraciones se aplican aparte (`pnpm db:migrate -- up --yes` con la `DATABASE_URL` del propietario del esquema).

## Estructura

```
apps/web            Next.js: app/ (rutas y cockpit), lib/ (handlers), middleware.ts (flags, límite de tasa)
packages/*          dominio puro, folds, calculadoras, catálogos, kernel transaccional, gobierno de seguridad
db/migrations       0001..N + manifest.json (sha256); db/roles_v16.sql
scripts/            ci/ (bootstrap y smoke), db/ (migrador), ops/ (auditoría, outbox), v22/ (pruebas en vivo)
tests/              vitest; tests/traceability = contratos exigidos por el gate de release
docs/               ADRs, runbooks, revisiones, cumplimiento, adjudicación
```
