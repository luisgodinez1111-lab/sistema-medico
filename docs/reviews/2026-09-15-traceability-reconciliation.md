# Reconciliación de trazabilidad — sesión 2026-09-15 (opción A)

A petición del usuario ("¿estás siguiendo el plan de los 4 documentos y el scaffold?"), este
informe **reconcilia lo construido esta sesión con el registro de capacidades del scaffold** y
declara honestamente lo que sí sigue los documentos y lo que es deuda de gobierno.

## Hallazgo clave

El scaffold **ya anticipó** todo el trabajo de esta sesión: las capacidades existen en
`capabilities/catalog.json` (208 capacidades) con su autoridad ENG, hazards, controles,
invariantes, SMs y tests. No hubo que inventar capacidades. Ejemplos que mapean 1:1 a mis épicas:

| Implementado (épica) | Capacidad existente en el catálogo |
| --- | --- |
| Encuentro autenticado (B) | `CAP-VERTICAL-ENCOUNTER-001` |
| Assess/Sign runtime (D) | `CAP-ENCOUNTER-RUNTIME-003` |
| Resultados closed-loop (G) | `CAP-VERTICAL-RESULT-001`, `CAP-RESULT-OBLIGATION-002` |
| Medicación (H) | `CAP-MED-AUTH-003` |
| Documentos (I) | `CAP-AMENDMENT-001` (Immutable Signed-Record Amendment Ledger) |
| Emisión de sesión (E) | `CAP-SESSION-001` |
| Verificación OIDC (F) | `CAP-IDENTITY-001`, `CAP-IDENTITY-BOUNDARY-003` |
| RBAC rol→scope | `CAP-AUTHZ-001`, `CAP-RUNTIME-AUTH-003` |
| Fix actorId UUID | `CAP-UUID-BOUNDARY-001` (Strict UUID Persistence Boundary) |
| Capa app / UI | `CAP-APP-001` |

Notablemente, `CAP-UUID-BOUNDARY-001` describe exactamente el defecto real (subject de IdP no-UUID
en columnas uuid) que un usuario real destapó y que corregí — el scaffold lo había previsto.

## Qué se produjo (opción A)

`docs/adjudication/session-2026-09-15-reconciliation.json`: liga cada capacidad implementada a su
**ENG (del catálogo) → invariantes → mis tests nuevos (`tests/v22/*`) → mi evidencia de runtime EN
VIVO** (`scripts/v22/*` + `docs/reviews/2026-09-15-*`), marcado `requires_human_c5_acceptance: true`.
**No modifica el registro autoritativo** (misma disciplina que la adjudicación del golden slice,
Epic A): es *preparar la evidencia* para la aceptación C5, no sustituirla.

## Gate de seguridad: verde

`validate-registry` → **PASS** ("formal safety registry admission checks"): toda invariante C4/C5
tiene test, los envelopes de IA tienen kill-switch + aprobación humana + evidencia, y las SMs
formales existen. `Authority Gates` CI (`release:check`) verde en cada commit de la sesión.

## Declaración honesta (lo que SÍ y lo que NO)

**Fiel a los documentos:** las invariantes V2 se cumplen y están probadas en vivo (Physician
Control, Zero Lost Follow-Up, registro firmado inmutable + addendum append-only, tenant isolation,
auditoría encadenada). Reutilicé el dominio del scaffold; cité autoridad PROD donde existe.

**Deuda / desviaciones reconocidas:**
1. Durante la construcción **no fui actualizando la trazabilidad**; lo hago ahora en lote (esta
   reconciliación). El orden ideal (auditoría dixit) era *adjudicar antes de expandir*; expandí
   primero. Queda saldado a nivel de evidencia; la **adjudicación C5 sigue pendiente (humana)**.
2. Auth0/OIDC/RBAC son **implementaciones** del boundary de identidad (los docs definen el
   boundary y las leyes EXEC, no el proveedor); la elección federada se tomó con el usuario.
3. La UI `/workspace` es un **andamio funcional**, no la UX de producto V2 (PROD-011: timeline,
   problem list, quick actions).
4. Endurecimiento de producción pendiente: retirar verificador dev, cookie httpOnly, revisar
   conexión Neon serverless.

## Estado

`release_state`: **BLOCKED** solo por revisión humana C5 — correcto y esperado. El código y su
evidencia están alineados con el catálogo del scaffold; falta la **aceptación humana** de la
cadena PROD↔ENG↔EXEC (que ninguna herramienta puede sustituir, por diseño de los documentos).
