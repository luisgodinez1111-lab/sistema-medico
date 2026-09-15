# Análisis — Registro de Trazabilidad (4.º doc) + Scaffold `medical-os` (15-sep-2026)

Addendum al informe `2026-09-15-V2-spec-review.md`. El usuario entregó dos artefactos más:

1. **Executable Traceability Registry v21.0** (`.xlsx`, 94 hojas, 3 734 filas) — el registro
   machine-readable que faltaba. Almacenado en
   `docs/engineering/v2.1/traceability-registry/` (`.xlsx` + 94 `.csv`).
2. **Scaffold `medical-os-v21_0/`** — el monorepo objetivo ya materializado (en `~/Downloads`,
   **aún fuera de control de versiones**).

## Qué es el Registro (resuelve S1-1/S1-2/S1-3)

Generado **directamente de los 3 documentos** almacenados (hoja `Executive_Control`):
Product `V2.0.1` (176 secciones ACTIVE / 759 requisitos atómicos), Engineering `V2.1.1`
(347 / 1220), Execution `Companion` (1652). Estado: **"DETAILED REVIEW / NOT YET
RELEASE-FROZEN"**. Hojas clave: `PROD_to_ENG`, `ENG_to_EXEC`, `Atomic_PROD_to_ENG`,
`INV/HAZ/SM/AI_TASK/TEST_Registry`, `Safety_Gates`, `Executable_Gates`,
`Release_Admission_v1`, `Mapping_Adjudication`, `Repository_Manifest`,
`Implementation_Roadmap`, + control por versión `v0.6 … v21.0`.

**Leyes anti-orphan (`Registry_Laws`, TRL-001…012)** — coinciden con lo que exigí:
similitud semántica solo genera candidatos; un mapping es autoritativo **solo por revisión**;
FUTURE/HISTORICAL/SUPERSEDED no satisface release; mapping faltante = `TRACEABILITY-PENDING`
= BLOCKED; C4/C5 exigen invariante + test; async crítico exige reconciliación; IA de alto
impacto exige AI-TASK + Safety Envelope; unknown/conflicting deben permanecer explícitos.

## Qué es el Scaffold (es "empezar limpio" ya materializado — resuelve S1-4/S2-7)

`package.json name: "medical-os"`, pnpm 10.15.1, **zod v4 en boundaries** (cierra S2-7),
tsconfig ultra-estricto (`strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes`).

- **242 packages** gobernados (micro-paquetes por capacidad: `ai-authority-gate`, `authz`,
  `atomic-clinical-transaction v1..v3`, `audit-chain v2/v3`, `amendment-ledger`,
  `break-glass`, `calculation-receipt`, `canonical-json`, `clinical-api`, …).
- **`AGENTS.md`** = router de autoridad (PROD→ENG→EXEC→registro→code; nunca inferir por
  similitud; C4/C5 requiere INV+TEST; async crítico requiere SM+reconciliación+recovery;
  IA de alto impacto requiere AI-TASK+envelope+human+kill-switch).
- **21 ADRs** (`ADR-0011…0210`), `capabilities/catalog.json` (CAP→ENG/HAZ/CTL/INV/SM/TEST,
  `releasePolicy: FAIL_CLOSED`), `safety/`, `safety-envelopes/`, `ai-tasks/`,
  `state-machines/formal/`, `tests/v6…v21`, `release/v5…v17` self-checks.
- **Gate real** `packages/clinical-safety/src/validate-registry.ts`: falla si un invariante
  C4/C5 no tiene test, si un AI envelope no tiene `kill_switch`/`human_approval`/`evidence`,
  o si falta una máquina formal (RESULT/OBLIGATION/MED/TRUTH).
- Historial `registry_meta_v0.6 … v21.0`: conformidad estática **PASA** en v21
  (`capabilities 208`, `static_s1=0`, `static_s2=0`, `repository_audit PASS`,
  `migration_integrity PASS`).

## El único bloqueo restante: EVIDENCIA FÍSICA DE RUNTIME

`registry_meta_v21_0.json` → `release_state: BLOCKED`. Motivo (hoja `v21_0_Blockers` +
`ADR-0210`): el entorno que generó el scaffold **no tenía PostgreSQL ni runtime**, así que la
evidencia de runtime quedó **`NOT_RUN` (no simulada)** — honestidad correcta. Pendientes:

| Blocker | Estado | Para cerrarlo |
| --- | --- | --- |
| Live PostgreSQL | NOT_RUN | `TEST_DATABASE_URL` Postgres 17 / Neon-compatible |
| Live RLS | NOT_RUN | roles runtime/worker vs sondas cross-tenant/missing-context |
| Dependency-backed compile | NOT_RUN | `pnpm install` + `tsc` + `next build` |
| Full Vitest | NOT_RUN | 146 test sources en entorno reproducible |
| Concurrency / Crash recovery / HTTP fuzzing / Restore drill / Performance | NOT_RUN | harnesses de runtime |
| Governance | BLOCKED | RG-001 + revisión humana C5 + reconciliación de 118 candidatos IA |

> **Aquí está el aporte inmediato:** este entorno **sí** tiene Node+pnpm y una Postgres
> **Neon** (`DATABASE_URL`). Podemos producir la mayor parte de la evidencia física
> (`install` + `typecheck` + `vitest` + harness Postgres/RLS + `next build`) y desbloquear
> los gates que hoy están `NOT_RUN` — sin simular nada (respetando `ADR-0210`).

## Estado de los hallazgos del informe previo

- **S1-1 (PRODUCT-GAP)** → el registro tiene `Mapping_Adjudication` + `Atomic_PROD_to_ENG`;
  se resuelve por adjudicación en el registro (no por prosa). Falta verificar que la
  promoción `PROD-114…177` esté reflejada como mapping aprobado (revisión pendiente).
- **S1-2 (registro faltante)** → **RESUELTO**: el registro existe y es el 4.º documento.
- **S1-3 (4.º documento)** → **RESUELTO**: era este registro (+ el scaffold).
- **S1-4 (repo→limpio)** → el scaffold **es** el arranque limpio de `medical-os`.
- **S2-7 (validación boundary/zod)** → **RESUELTO**: zod v4 en el scaffold.
- **Nuevo:** el scaffold está **fuera de control de versiones** (solo en `~/Downloads`) →
  riesgo de pérdida; debe versionarse (ver decisiones).

## Decisiones para el usuario

1. **¿Versionar/adoptar el scaffold como el repo `medical-os`?** (git-init + primer commit)
   — es a la vez almacenamiento durable y el arranque limpio decidido.
2. **¿Producir la evidencia física de runtime?** (`pnpm install` + `typecheck` + `vitest` +
   harness Postgres/RLS contra Neon + `next build`) para cerrar los blockers `NOT_RUN` de v21.
