# Medical OS

> **Clinical Operating System** · SaaS multi-tenant · México-first · internacionalizable

Medical OS no es "un expediente clínico con agenda". Es un **sistema operativo clínico**
que mantiene el estado longitudinal del paciente, acompaña el razonamiento del médico,
evita ciclos de atención abiertos, ejecuta operaciones administrativas y conserva
trazabilidad verificable de cada decisión relevante.

Este repositorio se construye siguiendo el **Plan Maestro de Construcción** (v1), en el
orden exacto de sus 19 pasos (§36) y por releases secuenciales R0 → R7 (§29).

## Principios no negociables

1. La complejidad vive detrás de la interfaz.
2. Patient-first y encounter-centric.
3. No existen datos clínicos "sueltos": origen, estado, versionado y provenance.
4. Ningún estudio/resultado crítico queda sin propietario, estado y criterio de cierre.
5. La IA propone; nunca altera silenciosamente el expediente.
6. Zero Trust, mínimo privilegio, defensa en profundidad, detección y recuperación.
7. Normativa, privacidad, auditoría y seguridad son arquitectura, no un anexo.
8. Diseño multiplataforma desde el sistema de diseño, no parches responsive.
9. Decisiones clínicas asistidas: versionadas, justificables y gobernadas.
10. La deuda técnica que comprometa seguridad/integridad/aislamiento **bloquea releases**.

## Stack (§3)

| Dominio          | Decisión                                             |
| ---------------- | ---------------------------------------------------- |
| Full-stack       | Next.js + TypeScript en Vercel                       |
| Base de datos    | Neon Postgres (pooling, branching, PITR)             |
| ORM/data access  | Drizzle ORM + capa repository tenant-scoped          |
| Validación       | Zod en todos los límites de entrada                  |
| UI               | Design system propio sobre primitives accesibles     |
| Archivos         | Object storage privado (DB sólo metadata/hash)       |
| Asíncrono        | Queues / workflows durables                          |
| Auth             | IdP con MFA/WebAuthn; **authorization sí es dominio propio** |

## Estructura del monorepo (§4)

```
medical-os/
├─ apps/web/                  # Next.js
├─ packages/
│  ├─ shared/                 # tipos no clínicos comunes
│  ├─ clinical-domain/        # entidades y reglas clínicas puras
│  ├─ clinical-content/       # pathways versionados (sin UI)
│  ├─ db/                     # schema, migrations, repositories
│  ├─ authz/                  # RBAC + ABAC + ReBAC policy engine
│  ├─ audit/                  # audit / provenance events
│  ├─ design-system/          # componentes UI
│  ├─ interoperability/       # FHIR / HL7 / DICOM mappings
│  ├─ security/               # crypto helpers, redaction, policies
│  └─ observability/          # telemetry
├─ workers/                   # consumers / workflows
├─ infra/                     # config, runbooks, IaC
├─ docs/{adr,threat-models,clinical-governance,compliance}/
└─ tests/
```

## Desarrollo local

```bash
pnpm install
pnpm dev          # levanta apps/web
pnpm typecheck    # verificación de tipos en todo el monorepo
pnpm lint
pnpm test
```

## Estado de construcción

Ver [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md) para el avance por niveles/releases.

## Decisiones de arquitectura

Ver [`docs/adr/`](docs/adr/). Toda decisión estructural queda registrada como ADR.
