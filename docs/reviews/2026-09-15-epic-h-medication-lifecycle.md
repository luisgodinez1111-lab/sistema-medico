# Epic H — Ciclo de vida de medicación / prescripción (15-sep-2026)

Cuarto vertical clínico. Ciclo de vida de la medicación sobre el kernel, con **Physician Control**
como invariante estrella: **cualquier clínico (o la IA) puede PROPONER una medicación, pero solo un
médico humano puede PRESCRIBIRLA** — la IA nunca escribe la orden firmada.

## Endpoints (molde Epic D/G)

| Método/Ruta | Transición | Authz |
| --- | --- | --- |
| `POST /api/v1/medications` | — → PROPOSED | `medication:propose` (cualquier clínico) |
| `POST /api/v1/medications/:id/prescription` | PROPOSED → PRESCRIBED | **PHYSICIAN** + `medication:write` |
| `POST /api/v1/medications/:id/activation` | PRESCRIBED → ACTIVE | PHYSICIAN + `medication:write` |
| `POST /api/v1/medications/:id/discontinuation` | {ACTIVE,HELD} → STOPPED (razón requerida) | PHYSICIAN + `medication:write` |

`packages/medication-fold` (SM subconjunto de `medication-domain`), concurrencia optimista
(If-Match), envelope determinista + `lookupReplay`. Sin migración nueva (usa `clinical_events`).

## Physician Control (invariante estrella)

`PROPOSE` no exige rol médico (scope `medication:propose`); la propuesta puede venir de una enfermera
o del copiloto de IA. `PRESCRIBE` exige `role=PHYSICIAN` — es la decisión clínica firmada, y el evento
lleva autoridad `HUMAN` (kernel). No hay ruta de IA a PRESCRIBED → estructuralmente **la IA nunca
prescribe**. Esto materializa la ley EXEC-0003 (no silent AI / IA nunca escribe registro firmado).

## Evidencia

- `pnpm typecheck` PASS · `pnpm test` **223/223** (+6 fold) · `pnpm build:web` PASS (4 rutas `ƒ`).
- **Evidencia física EN VIVO contra Neon: PASS 12/12**
  (`scripts/v22/live-medication-lifecycle-proof.mts`):

| Check | Qué prueba |
| --- | --- |
| NURSE_PROPOSE_201 | Una enfermera puede proponer |
| **NURSE_PRESCRIBE_FORBIDDEN_403** | Physician Control: la enfermera NO prescribe |
| PHYSICIAN_PRESCRIBE_201_v2 | El médico sí prescribe |
| PRESCRIBE_REPLAY_200 | Replay idempotente |
| STOP_FROM_PRESCRIBED_ILLEGAL_409 · ACTIVATE_AFTER_STOPPED_409 | SM formal bloquea transiciones ilegales |
| ACTIVATE_201_v3 · DISCONTINUE_201_v4 | Lifecycle completo (v1→4) |
| STOP_WITHOUT_REASON_400 | Suspender exige razón (trazabilidad) |
| OPTIMISTIC_CONFLICT_409 | Concurrencia optimista del kernel |
| CROSS_TENANT_404 | Aislamiento RLS |
| MISSING_SCOPE_403 | Sin scope no hay acción (aunque sea médico) |

## Estado

Cuatro verticales clínicos sobre el kernel probado (encuentro, ciclo de vida encuentro, resultados
closed-loop, medicación) + auth completo (sesión + OIDC, backend). La adjudicación de trazabilidad
de estas capacidades sigue pendiente de aceptación humana C5.
