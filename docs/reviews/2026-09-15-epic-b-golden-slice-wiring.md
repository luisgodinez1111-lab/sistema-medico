# Epic B — Wiring del Golden Slice App/API (15-sep-2026)

Convierte el primer vertical clínico de **stub deny-by-default (503)** a **endpoint real
protegido por sesión verificada + authz server-side + RLS + kernel atómico probado**.
No agrega features nuevas: **conecta** las capas que ya estaban probadas a nivel dominio/datos
(Epic anterior) detrás de una frontera HTTP fail-closed.

## Alcance (un vertical, C5)

`POST /api/v1/encounters` (abrir encuentro) y `GET /api/v1/encounters?encounterId=` (leer
agregado, metadatos no-PHI). Autoridad: PROD (encuentro) → ENG (kernel atómico + RLS) →
EXEC-0003 (authz server-side, no orphan, no PHI en telemetría).

## Piezas nuevas

| Archivo | Rol | Invariante |
| --- | --- | --- |
| `packages/http-principal/src/index.ts` | Adaptador sesión→Principal+TenantContext | Physician Control / tenant isolation; fail-closed |
| `apps/web/lib/http-errors.ts` | Mapeo determinista error clínico→HTTP, sin PHI | No fuga de detalle interno |
| `apps/web/lib/clinical-runtime.ts` | Conexión Postgres (rol runtime en el startup) + `runClinicalCommand`/`readEncounter` | RLS realmente forzado (owner de Neon tiene BYPASSRLS) |
| `apps/web/app/api/v1/encounters/route.ts` | Endpoint POST/GET cableado | Deny-by-default salvo sesión+rol+propósito válidos |
| `apps/web/next.config.mjs` | `serverExternalPackages:["postgres"]` | Bundle correcto de la Function |
| `db/migrations/0017_runtime_role_grants.sql` | GRANTs least-privilege al rol runtime | RLS + mínima superficie |
| `tests/v22/http-principal.test.ts` | 10 tests unitarios del adaptador + mapeo | — |
| `scripts/v22/live-encounter-endpoint-proof.mts` | Evidencia física en vivo (8 fases) | — |

## Dos defectos reales que solo destapó la ejecución (reparados)

1. **RLS sin GRANTs (`permission denied for table command_idempotency`).** El modelo de roles
   existía (NOBYPASSRLS) pero faltaba el least-privilege por tabla. Se corrigió con la migración
   `0017_runtime_role_grants.sql` (SELECT/INSERT/UPDATE mínimos + EXECUTE sobre `append_audit_v17`),
   aplicada a Neon. Además, el rol se fija en el **startup** de la conexión (`-c role=medical_os_runtime`)
   en vez de `SET LOCAL ROLE` — `postgres.js` no anida con `.begin` (usa savepoints), y el kernel abre
   su propia transacción con `.begin`.
2. **Idempotencia rota por envelope volátil.** El kernel hashea el comando completo; generar
   `commandId/eventId/occurredAt` aleatorios por-request hacía que un reintento con la misma
   `Idempotency-Key` divergiera → `IDEMPOTENCY_CONFLICT` en vez de replay. Corrección: **envelope
   determinista** — todos los IDs se derivan del `Idempotency-Key` y `occurredAt` lo acuña el
   cliente (contrato estilo Stripe: mismo key + mismo cuerpo = misma operación).

## Decisiones de seguridad clave

1. **RLS real, no del owner.** El owner de Neon (`neondb_owner`) tiene `rolbypassrls=true`; por
   eso cada transacción hace `SET LOCAL ROLE medical_os_runtime` (NOBYPASSRLS). El rol persiste
   al **savepoint** que abre `executeAtomicClinicalCommand`, así que el kernel corre bajo RLS.
2. **Fail-closed en cadena.** Sin `SESSION_SIGNING_SECRET` → `SAFETY_BLOCKED` (403). Sin token /
   token manipulado / expirado → `UNAUTHENTICATED` (401). Rol/propósito insuficiente → 403.
   Sin `Idempotency-Key` → 428. Payload inválido (zod) → 400. Error interno → 500 genérico
   (nunca se serializa el mensaje/stack real ni el payload clínico).
3. **Idempotencia + concurrencia** las provee el kernel ya probado: reintento con misma
   `Idempotency-Key` → 200 `replayed`; `expectedVersion` optimista.
4. **Sin PHI.** El payload del evento (patientId, clase) vive en `clinical_events` (RLS), nunca
   en logs ni en la respuesta de lectura (que devuelve solo `{sequence,type,occurredAt}`).

## Evidencia estática (producida esta sesión)

- `pnpm typecheck` → **PASS** (tsconfig ultra-estricto).
- `pnpm test` → **PASS 184/184** (147 files; +10 vs 174 previos).
- `pnpm build:web` → **PASS**; `/api/v1/encounters` pasa a `ƒ (Dynamic)`.

## Evidencia física en vivo (la corre el usuario)

```bash
pnpm exec tsx ./scripts/v22/live-encounter-endpoint-proof.mts
```

Requiere `DATABASE_URL` (Neon) en `.env.local` y que el rol `medical_os_runtime` tenga los
GRANTs de tabla + `GRANT medical_os_runtime TO current_user` (aplicados en sesiones previas).
Fases y aserciones esperadas:

| Fase | Aserción |
| --- | --- |
| P1 OPEN | 201, version=1, replayed=false, auditHash presente |
| P2 REPLAY | 200, replayed=true, version=1 (misma Idempotency-Key) |
| P3 READ | 200, version=1, 1 evento (`type=Encounter`) |
| P4 CROSS-TENANT | 404 (tenant B no ve el encuentro de A) |
| P5 NO-SESSION | 401 |
| P6 ROLE | 403 (rol NURSE no abre encuentros) |
| P7 IDEMPOTENCY | 428 (falta `Idempotency-Key`) |
| P8 VALIDATION | 400 (encounterId no-uuid) |

### Resultado ejecutado (15-sep-2026, contra Neon)

**PASS — 10/10 checks.** Salida real:
`OPEN_201_v1, AUDIT_HASH_PRESENT, IDEMPOTENT_REPLAY_200, READ_200_v1, EVENT_AGGREGATE_TYPE,
CROSS_TENANT_ISOLATION_404, NO_SESSION_401, ROLE_FORBIDDEN_403, IDEMPOTENCY_REQUIRED_428,
VALIDATION_400`. El endpoint quedó probado end-to-end: sesión firmada → authz → RLS (rol
`medical_os_runtime`) → escritura atómica (idempotencia + evento + outbox + audit-chain) →
lectura RLS-scoped. Estático en la misma sesión: `typecheck` PASS, `test` **184/184**, `build:web` PASS.

## Configuración de despliegue (Vercel)

Añadir `SESSION_SIGNING_SECRET` (alta entropía) a las env vars del proyecto. Mientras no exista,
el endpoint responde **403 fail-closed** (correcto): la ruta no se abre sin secreto configurado.

## Qué sigue (Epic C)

Restore drill (necesita Neon desechable) + benchmark de performance. El resto de verticales
(medicación, órdenes/resultados, notas/firma) se cablean con el **mismo patrón** probado aquí.
