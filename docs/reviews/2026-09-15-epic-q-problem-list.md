# Epic Q — Lista de problemas (problem list) (15-sep-2026)

Octavo vertical clínico. Diagnósticos/problemas activos del paciente — central al chart
(PROD-011-R005). Autoridad: **CAP-PROBLEM-GRAPH-001**.

## Endpoints
- `POST /api/v1/problems` (— → ACTIVE)
- `POST /api/v1/problems/:id/resolution` (→ RESOLVED, **nota requerida**)
- `POST /api/v1/problems/:id/reactivation` (RESOLVED → ACTIVE)
- `POST /api/v1/problems/:id/chronicity` (ACTIVE → CHRONIC)

`packages/problem-fold` (SM ACTIVE↔RESOLVED, CHRONIC, ENTERED_IN_ERROR), scope `problem:write`
(RBAC PHYSICIAN+NURSE), concurrencia optimista, lookupReplay. UI: panel de problemas + conteo de
"Problemas activos" en el header de resumen (patient-summary). Aparece en el timeline.

## Evidencia
- typecheck PASS · vitest **267/267** (+7) · build PASS (4 rutas `ƒ`).
- **Evidencia física EN VIVO contra Neon: PASS 9/9** (`scripts/v22/live-problem-lifecycle-proof.mts`):
  ADD_ACTIVE_201, RESOLVE_WITHOUT_NOTE_400, RESOLVE_201_v2, RESOLVE_REPLAY_200, REACTIVATE_201_v3,
  CHRONIC_201_v4, REACTIVATE_CHRONIC_ILLEGAL_409, CROSS_TENANT_404, MISSING_SCOPE_403.
