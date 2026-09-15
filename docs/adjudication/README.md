# Adjudicación de Trazabilidad — Golden Slice (PROPUESTA)

> **Autoridad:** esto es una **propuesta generada por agente con evidencia**, NO autoridad.
> Los TRL del Registro de Trazabilidad exigen **aceptación humana** ("registry acceptance";
> *candidate scores are evidence, not authority*). Un revisor **C5** decide
> `REVIEW_REQUIRED → APPROVED`. Artefacto machine-readable: `golden-slice-adjudication.json`.

## Qué resuelve

La auditoría (`docs/reviews/2026-09-15-scaffold-audit.md`) encontró que **115/176** mapeos
PROD→ENG están en `REVIEW_REQUIRED` y `Mapping_Adjudication` está vacío. Esta propuesta cubre
**16 capacidades del golden slice** que ya tienen **evidencia estática + de runtime EN VIVO**
(producida el 2026-09-15), para que un revisor pueda aceptarlas con fundamento.

## Cadena de evidencia por capacidad

Cada ítem del JSON liga: **capability → ENG authority → invariantes → hazards → controles →
state machines → tests → evidencia de runtime**. Las 16:

| Capability | Riesgo | Evidencia de runtime |
| --- | --- | --- |
| CAP-IDENTITY-001 · Identity/Tenant/Access | C5 | live-rls, live-postgres |
| CAP-DB-001 · Transactional Persistence & RLS | C4 | live-postgres, live-rls |
| CAP-POSTGRES-001 · Tenant-Scoped PG Adapter | C5 | live-postgres, live-rls |
| CAP-AUTHZ-001 · Tenant/Role/Scope/Purpose Authz | C4 | live-rls |
| CAP-EVENTS-001 · Clinical Event Kernel | C5 | live-concurrency, vitest |
| CAP-AGGREGATE-001 · Versioned Aggregate Store | C5 | live-concurrency, vitest |
| CAP-ATOMIC-001 · Atomic Clinical Write | C5 | live-concurrency, live-crash-recovery, vitest |
| CAP-IDEMPOTENCY-002 · Persistent Idempotency | C5 | live-concurrency, vitest |
| CAP-ASYNC-001 · Reliable Outbox | C5 | live-concurrency, vitest |
| CAP-AUDIT-001 · Tamper-Evident Audit Ledger | C5 | live (audit-chain), vitest |
| CAP-AUDIT-002 · Audit Chain Verification | C5 | vitest |
| CAP-RESILIENCE-001 · Runtime Resilience | C4 | vitest (circuit-breaker reparado) |
| CAP-OBLIGATION-002 · Clinical Obligation Domain | C5 | vitest |
| CAP-RESULTS-001 · Diagnostic Results Closed Loop | C5 | vitest |
| CAP-TRUTH-001 · Clinical Truth & Epistemic | C5 | vitest |
| CAP-RECONCILIATION-003 · Accountable Failure | C5 | live-crash-recovery, vitest |

Artefactos de evidencia referenciados: `release/test-execution.json` (Vitest 174/174),
`docs/reviews/2026-09-15-runtime-evidence.md` (live Postgres/RLS/concurrency/crash),
`registry_meta_v22_0.json`, y el CI verde (`release:check` = 10 gates PASS).

## Cómo aceptar (revisor C5)

1. Revisar cada ítem del JSON y su evidencia.
2. Para los aceptados, marcar en el Registro (`PROD_to_ENG_Reviewed`) las filas PROD
   correspondientes como `APPROVED` y registrar la decisión en `Mapping_Adjudication`
   (con `Required Decision`, `Status=APPROVED`, y referencia a esta evidencia).
3. Lo **no aceptado** permanece `REVIEW_REQUIRED` (fail-closed).

> Esta propuesta **no** modifica el registro autoritativo (xlsx/CSV); solo aporta la
> evidencia y la recomendación para que la aceptación humana sea informada.
