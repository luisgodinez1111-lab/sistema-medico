# Epic N — Timeline del paciente (lectura/proyección) (15-sep-2026)

Primera **lectura/proyección** más allá del GET de un solo agregado. Vista longitudinal de los
items clínicos de un paciente (encuentro, orden, medicación, resultado, documento). Autoridad de
producto: **PROD-011-R010** ("Timeline filtra por problem/medication/result/document/encounter").

## Diseño
`GET /api/v1/patients/:id/timeline` — `readPatientTimeline` (clinical-runtime) consulta
`clinical_events` **RLS-scoped**, agrupando por `aggregate_id` los que pertenecen al paciente
(evento de creación con `payload->>'patientId'`), y devuelve por item: **tipo, último kind (estado),
versión, fechas**. **SIN PHI**: solo metadatos, nunca el contenido clínico. Authz nuevo scope
`patient:read` (añadido al RBAC de PHYSICIAN/NURSE/CLINICAL_ADMIN). UI: panel "Timeline del paciente"
en `/workspace`. Es una **proyección de lectura**: su autoridad de seguridad la heredan authz+RLS.

## Evidencia
- typecheck PASS · vitest **253/253** · build PASS (`/api/v1/patients/:id/timeline` = `ƒ`).
- **Evidencia física EN VIVO contra Neon: PASS 6/6** (`scripts/v22/live-patient-timeline-proof.mts`):
  TIMELINE_200, TIMELINE_HAS_3_TYPES, TIMELINE_EXACTLY_3_ITEMS, TIMELINE_HAS_KINDS,
  CROSS_TENANT_EMPTY (aislamiento RLS), MISSING_SCOPE_403.
