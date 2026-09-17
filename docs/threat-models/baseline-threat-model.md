# Threat Model — Baseline (STRIDE)

> Autoridad: **ENG-044 / ENG ciclo 3** (¿puede demostrarse confidencialidad, integridad, disponibilidad,
> trazabilidad y aislamiento?). Endurecimiento eje G, Epic BI (2026-09-17). Referenciado por la jerarquía
> de `SPEC_INDEX.md` (`docs/threat-models/`). Baseline: se profundiza con cada superficie nueva.

## Activos protegidos

- **PHI / expediente clínico** (contenido de `clinical_events`, RLS-aislado).
- **Integridad del registro firmado** (cadena de auditoría `audit_chain_v3`).
- **Identidad y sesión** (tokens, cookie httpOnly).
- **Aislamiento entre tenants**.

## STRIDE → controles (con evidencia)

| Amenaza | Vector | Control | Evidencia |
| --- | --- | --- | --- |
| **S**poofing | Sesión falsificada / sin auth | Verificación de sesión firmada + scope/purpose | CAP-IDENTITY-001, CAP-AUTHZ-001 |
| **T**ampering | Alterar un registro clínico | Event store append-only + cadena de auditoría encadenada (hash) | db/migrations/0013_transactional_authority_and_audit.sql; CAP-BACKUP-DR-001 |
| **R**epudiation | Negar una acción firmada | Auditoría por evento (actor, purpose, correlación) encadenada | db/migrations/0013_transactional_authority_and_audit.sql |
| **I**nformation disclosure | Fuga cross-tenant / PHI en logs | RLS forzado (rol NOBYPASSRLS) + telemetría sin PHI (allowlist) | db/policies/tenant_rls_v3.sql; CAP-OBSERVABILITY-SLI-001 |
| **D**enial of service | Indisponibilidad del almacén | Fail-closed 503 (nunca 'guardado' en falso) + recuperabilidad (DR) | CAP-BACKUP-DR-001; tests/v22/downtime-no-false-save.test.ts |
| **E**levation of privilege | Escalar rol/tenant | Authz por rol/scope/purpose; RLS no confía en el front | CAP-AUTHZ-001; db/policies/tenant_rls_v3.sql |

## Invariantes de seguridad (no negociables)

- **No frontend authorization** — la autoridad se decide server-side.
- **Tenant isolation** como comportamiento de primera clase (RLS forzado en el startup del pool).
- **No PHI in telemetry by default** — enforzado por allowlist (CAP-OBSERVABILITY-SLI-001).
- **Fail-closed** — todo fallo o indisponibilidad se traduce a error, nunca a un éxito silencioso.
- **Safety-critical nunca depende exclusivamente de IA generativa** (núcleo determinista; R6 en pausa).

## Brechas conocidas / pendientes

- Pentest formal e IAM hardening (rotación de secretos, verificador dev en producción — ver eje G #6).
- Modelado de amenaza específico por integración externa (cuando se conecten).
- Gobierno de transferencias de datos y notificación de brechas (ver LFPDPPP en el registro de compliance).
