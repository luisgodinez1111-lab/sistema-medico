# Epic G — Closed-loop de resultados + Zero Lost Follow-Up (15-sep-2026)

Tercer vertical clínico. Modela el ciclo de vida del **resultado diagnóstico** sobre el kernel y
**cierra la historia Zero Lost Follow-Up** que Epic D dejó abierta: un resultado **crítico** que
requirió acción y no se ha cerrado **bloquea la firma** del encuentro del paciente; al cerrarlo con
evidencia, la firma se **desbloquea**.

## Endpoints (mismo molde que Epic D)

| Método/Ruta | Transición |
| --- | --- |
| `POST /api/v1/results` | — (crea) → RECEIVED |
| `POST /api/v1/results/:id/verification` | RECEIVED → VERIFIED |
| `POST /api/v1/results/:id/action` | VERIFIED → ACTIONED (crea obligación) |
| `POST /api/v1/results/:id/closure` | ACTIONED → CLOSED (resuelve) |

Fold puro (`packages/result-fold`, subconjunto de la SM formal `order-result-domain`),
concurrencia optimista (If-Match), envelope determinista + `lookupReplay`, authz PHYSICIAN /
`result:write` / TREATMENT.

## El loop, sin proyección

El discriminador y los datos de consulta van en `payload` (el kernel no persiste el tipo de evento
como columna). `countOpenCriticalResults(patientId)` consulta el **event stream directamente**:
resultados `DiagnosticResult` del paciente en `ACTIONED`, `critical=true`, **sin** evento `CLOSED`
(plegado por `aggregate_id` vía `NOT EXISTS`). El gate de firma (`encounter-lifecycle`) ahora suma
`clinical_inbox` URGENT sin resolver **+** resultados críticos abiertos. Todo event-sourced y
atómico; sin tabla de proyección. Reutiliza el GRANT de `clinical_events` (0017) — sin migración nueva.

## Helpers compartidos

`apps/web/lib/http-command.ts` extrae `derivedUuid`/`principalFrom`/`requireMutationHeaders`/
`resolveVerified`/`buildCommand`/`parseJson` — el molde de vertical reutilizable.

## Evidencia

- `pnpm typecheck` PASS · `pnpm test` **217/217** (+8 fold) · `pnpm build:web` PASS (4 rutas `ƒ`).
- **Evidencia física EN VIVO contra Neon: PASS 12/12**
  (`scripts/v22/live-result-closed-loop-proof.mts`):

| Check | Qué prueba |
| --- | --- |
| RESULT_RECEIVED/VERIFIED/ACTIONED/CLOSED (v1→4) | Ciclo de vida completo |
| RESULT_ACTION_REPLAY_200 | Replay idempotente |
| RESULT_ILLEGAL_SKIP_409 | SM formal bloquea saltarse la verificación |
| LOOP_ENCOUNTER_READY | Encuentro evaluado listo para firmar |
| **SIGN_BLOCKED_BY_OPEN_CRITICAL_RESULT_403** | Zero Lost Follow-Up: firma bloqueada por resultado crítico abierto |
| RESULT_CLOSED_201_v4 | Cierre con evidencia (resuelve) |
| **SIGN_UNBLOCKED_AFTER_CLOSURE_201** | Firma desbloqueada tras cerrar el resultado |
| NON_CRITICAL_RESULT_DOES_NOT_BLOCK_201 | Control: un no-crítico no bloquea |
| CROSS_TENANT_RESULT_404 | Aislamiento RLS |
| ROLE_FORBIDDEN_403 | Physician Control (enfermera no escribe) |

## Estado

Tres verticales clínicos sobre el kernel probado (encuentro, ciclo de vida, resultados) + auth
completo (sesión + OIDC). La adjudicación de trazabilidad de estas capacidades sigue pendiente de
aceptación humana C5.
