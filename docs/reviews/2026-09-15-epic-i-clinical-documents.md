# Epic I — Documentos clínicos (firma reproducible + addendum append-only) (15-sep-2026)

Quinto vertical clínico. Ciclo de vida del documento clínico-legal sobre el kernel, alineado con
la spec de producto:
- **PROD-014-R022:** la firma produce un **snapshot reproducible**; toda corrección posterior es
  **addendum/amendment**.
- **PROD-022-R018:** **nunca** se borra el historial de firma/amendments (append-only).
- **PROD-030-R003:** status preliminary/final/amended.

## Endpoints (molde Epic D/G/H)

| Método/Ruta | Transición | Authz |
| --- | --- | --- |
| `POST /api/v1/documents` | — → DRAFT | `document:write` (cualquier clínico) |
| `POST /api/v1/documents/:id/finalization` | DRAFT → FINALIZED | `document:write` |
| `POST /api/v1/documents/:id/signature` | FINALIZED → SIGNED | **PHYSICIAN** + `document:write` |
| `POST /api/v1/documents/:id/amendment` | {SIGNED,AMENDED} → AMENDED (append-only) | **PHYSICIAN** + `document:write` |

`packages/document-fold` (SM + fold puro), concurrencia optimista (If-Match), envelope determinista
+ `lookupReplay`. Sin migración nueva (usa `clinical_events`; el contenido clínico vive en el
payload, RLS-aislado, nunca en logs).

## Invariantes clave (probadas en vivo)

- **Snapshot reproducible:** al firmar, `contentHash = sha256(contenido)`; el `signatureDigest`
  cubre `docId:version:contentHash:autor:firmadoEn`. Verificado que el hash coincide con el
  contenido → la firma es reproducible y detecta cualquier cambio.
- **Inmutabilidad:** un documento `SIGNED` no puede re-finalizarse ni editarse (409).
- **Addendum append-only:** las enmiendas se agregan como eventos nuevos (v4, v5, …); el fold
  cuenta `amendmentCount` y la versión solo crece — **el historial nunca se encoge**.
- **Physician Control:** cualquier clínico crea/finaliza un borrador, pero **solo un médico firma
  y enmienda** el registro clínico-legal (la IA nunca firma).

## Evidencia

- `pnpm typecheck` PASS · `pnpm test` **230/230** (+7 fold) · `pnpm build:web` PASS (4 rutas `ƒ`).
- **Evidencia física EN VIVO contra Neon: PASS 14/14**
  (`scripts/v22/live-document-lifecycle-proof.mts`): CREATE_DRAFT_201_v1, FINALIZE_201_v2,
  **NURSE_SIGN_FORBIDDEN_403**, SIGN_201_v3, **REPRODUCIBLE_SNAPSHOT_HASH**, SIGN_REPLAY_200,
  **SIGNED_IMMUTABLE_409**, AMEND_201_v4, AMEND_AGAIN_201_v5, AMEND_WITHOUT_TEXT_400,
  SIGN_DRAFT_ILLEGAL_409, OPTIMISTIC_CONFLICT_409, CROSS_TENANT_404, MISSING_SCOPE_403.

## Estado

Cinco verticales clínicos sobre el kernel probado (encuentro open/read, ciclo de vida encuentro,
resultados closed-loop, medicación, documentos) + auth backend completo. La adjudicación de
trazabilidad de estas capacidades sigue pendiente de aceptación humana C5.
