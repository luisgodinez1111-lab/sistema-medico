# Epic M — Órdenes clínicas (order lifecycle) (15-sep-2026)

Sexto vertical clínico. Ciclo de vida de la orden (lab/imagen/patología/procedimiento/referencia)
sobre el kernel, cerrando la cadena **orden → resultado** (el resultado ya existía, Epic G).

## Endpoints (molde probado)
| Método/Ruta | Transición |
| --- | --- |
| `POST /api/v1/orders` | — → DRAFT |
| `POST /api/v1/orders/:id/placement` | DRAFT → ORDERED |
| `POST /api/v1/orders/:id/fulfillment` | ORDERED → FULFILLED |
| `POST /api/v1/orders/:id/cancellation` | {DRAFT,ORDERED} → CANCELLED (razón) |

`packages/order-fold` (SM subconjunto de `order-result-domain`), authz PHYSICIAN + `order:write`
(añadido al RBAC), concurrencia optimista, envelope determinista, lookupReplay. Sin migración nueva.
Capacidad: **CAP-ORDER-RESULT-001** (autoridad ENG-306/337). UI: panel de órdenes en `/workspace`.

## Evidencia
- typecheck PASS · vitest **253/253** (+7 fold) · build PASS (4 rutas `ƒ`).
- **Evidencia física EN VIVO contra Neon: PASS 10/10** (`scripts/v22/live-order-lifecycle-proof.mts`):
  CREATE_DRAFT_201, FULFILL_FROM_DRAFT_ILLEGAL_409, PLACE_201_v2, PLACE_REPLAY_200, FULFILL_201_v3,
  CANCEL_AFTER_FULFILLED_409, CANCEL_FROM_DRAFT_201, OPTIMISTIC_CONFLICT_409, CROSS_TENANT_404, MISSING_SCOPE_403.
