# Epic O — Obligaciones de seguimiento (obligation lifecycle) (15-sep-2026)

Séptimo vertical clínico. Superficie de gestión del **Zero Lost Follow-Up**: crear, avanzar y
**completar con evidencia** obligaciones (care gaps / follow-up). Autoridad: **CAP-OBLIGATION-002**,
dominio `obligation-domain`.

## Endpoints
- `POST /api/v1/obligations` (— → OPEN)
- `POST /api/v1/obligations/:id/progress` (OPEN → IN_PROGRESS)
- `POST /api/v1/obligations/:id/completion` (→ COMPLETED, **exige evidencia**)
- `POST /api/v1/obligations/:id/cancellation` (→ CANCELLED, razón)

`packages/obligation-fold`, scope `obligation:write` (RBAC PHYSICIAN+NURSE), concurrencia optimista,
lookupReplay. Sin migración nueva. UI: panel de obligaciones en `/workspace`. Aparece en el timeline.

## Evidencia
- typecheck PASS · vitest **258/258** (+5 fold) · build PASS (4 rutas `ƒ`).
- **Evidencia física EN VIVO contra Neon: PASS 8/8** (`scripts/v22/live-obligation-lifecycle-proof.mts`):
  CREATE_OPEN_201, PROGRESS_201_v2, COMPLETE_WITHOUT_EVIDENCE_400, COMPLETE_201_v3, COMPLETE_REPLAY_200,
  CANCEL_AFTER_COMPLETED_409, CROSS_TENANT_404, MISSING_SCOPE_403.
