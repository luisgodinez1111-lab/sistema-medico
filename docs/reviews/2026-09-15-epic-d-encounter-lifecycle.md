# Epic D — Ciclo de vida del encuentro: assess + sign (15-sep-2026)

Segundo vertical clínico sobre el kernel probado, siguiendo la recomendación de la auditoría
("iterar capacidad por capacidad, cada una con mapping + invariante + test + evidencia"). Extiende
el encuentro abierto en Epic B con las transiciones **OPEN → READY_TO_SIGN → SIGNED**, ejerciendo
la **concurrencia optimista real sobre HTTP** (Epic B solo probó la creación en version 0) y dos
invariantes V2 de primer orden: **Physician Control** y **Zero Lost Follow-Up**.

## Endpoints

| Método/Ruta | Transición | Gates |
| --- | --- | --- |
| `POST /api/v1/encounters/:id/assessment` | OPEN → READY_TO_SIGN | sesión+PHYSICIAN, If-Match (versión), SM formal |
| `POST /api/v1/encounters/:id/signature` | READY_TO_SIGN → SIGNED | + Physician Control + Zero Lost Follow-Up |

## Modelo

- **Fold puro** (`packages/encounter-fold`): reconstruye el estado plegando el stream de eventos.
  El kernel **no** persiste el tipo de evento como columna (solo `aggregate_type`+`payload`), así
  que el discriminador va en `payload.kind` (`OPENED`/`ASSESSED`/`SIGNED`); el primer evento es
  siempre la apertura. La state machine formal (`encounter-domain`) valida cada transición.
- **Concurrencia optimista** vía `If-Match: <version>` → `expectedVersion` del kernel (autoridad).
- **Idempotencia + SM**: se resolvió la tensión real entre validar la SM y permitir el replay —
  un reintento de una transición **ya aplicada** no debe chocar con la SM (el estado ya avanzó).
  Solución: `lookupReplay` comprueba primero si el `Idempotency-Key` ya produjo **este mismo
  comando** (hash idéntico) y quedó `COMPLETED`; si sí, devuelve la respuesta guardada; si no,
  valida la SM y ejecuta.
- **Physician Control**: solo un médico humano autenticado firma (`role=PHYSICIAN`, autoridad
  `HUMAN` en el evento); no hay ruta de IA — estructuralmente la IA nunca firma.
- **Zero Lost Follow-Up**: no se firma con obligaciones críticas (`clinical_inbox` URGENT sin
  resolver) del paciente → GRANT SELECT least-privilege en `db/migrations/0018`.
- **Sin PHI en logs**: el contenido clínico vive en `clinical_events.payload` (RLS), nunca en logs.

## Evidencia

- `pnpm typecheck` PASS · `pnpm test` **194/194** (+10 fold) · `pnpm build:web` PASS
  (rutas `/api/v1/encounters/[encounterId]/{assessment,signature}` = `ƒ Dynamic`).
- **Evidencia física EN VIVO contra Neon: PASS 12/12**
  (`scripts/v22/live-encounter-lifecycle-proof.mts`):

| Check | Qué prueba |
| --- | --- |
| OPEN_201_v1 · ASSESS_201_v2 · SIGN_201_v3 | Camino feliz con versiones correctas |
| ASSESS_REPLAY_200 · SIGN_REPLAY_200 | Replay idempotente de cada transición |
| REASSESS_ILLEGAL_409 · ASSESS_AFTER_SIGNED_409 | SM formal bloquea transiciones ilegales |
| OPTIMISTIC_CONFLICT_409 | Concurrencia optimista del kernel (If-Match stale) |
| CROSS_TENANT_404 | Aislamiento RLS (tenant B no ve el encuentro de A) |
| ROLE_FORBIDDEN_403 | Physician Control (enfermera no escribe) |
| SIGN_WITHOUT_ASSESSMENT_403 | No se firma un encuentro sin nota |
| CRITICAL_OBLIGATION_BLOCKS_SIGN_403 | Zero Lost Follow-Up (obligación crítica bloquea firma) |

## Nota de gobierno

El patrón (fold + SM formal + concurrencia optimista + gates de invariante + evidencia en vivo)
es el molde reutilizable para los siguientes verticales (medicación, órdenes/resultados,
documentos). La adjudicación de trazabilidad de estas capacidades sigue pendiente de aceptación
humana C5 (como en Epic A).
