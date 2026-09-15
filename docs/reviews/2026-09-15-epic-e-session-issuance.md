# Epic E — Boundary de emisión de sesión (login) (15-sep-2026)

Da un consumidor real al `SESSION_SIGNING_SECRET` (Epic B): un endpoint que **acuña la sesión
firmada** a partir de una **identidad ya verificada**. Decisión tomada con el usuario: **Opción 1
(boundary + verificador federado)**, no un almacén de contraseñas propio — el scaffold no tiene
modelo de credenciales y la identidad está abstraída (`identity-boundary-v2` / `VerifiedIdentity`).
Inventar un almacén de contraseñas sería un mecanismo safety-critical **no especificado en V2**
(requeriría ADR); federar a un IdP es el patrón correcto para un sistema clínico.

## Endpoint

`POST /api/v1/sessions` — credencial (aserción/token del IdP) → sesión medical-os firmada
(`{token, sessionId, expiresAt, tokenType:"Bearer"}`, TTL 15 min).

## Arquitectura

- **Verificador enchufable** (`packages/session-issuance`, `IdentityVerifier`): toma una credencial
  opaca y devuelve `VerifiedIdentity` o lanza. La verificación real (firma/JWKS/expiración) vive en
  el adapter — un OIDC/JWT real se enchufa aquí sin tocar el resto.
- **Deny-closed:** sin verificador configurado → **503**. Hoy no hay verificador de producción
  cableado, así que **producción es deny-closed** (correcto y honesto: espera el IdP real).
- **Verificador de desarrollo** (`devIdentityVerifier`): un "IdP de pruebas" que firma aserciones
  con su **propio** secreto (`DEV_IDENTITY_SECRET`, separado del de sesión). **Deshabilitado DURO
  en producción** (`NODE_ENV==='production'` o `VERCEL_ENV==='production'` → sin verificador).
- **Emisión** (`issueSession`): valida la identidad (`assertIdentity`) y firma `SessionClaims` con
  `SESSION_SIGNING_SECRET` (secreto de sesión ≠ secreto del IdP). Vida corta (15 min).
- **Auditoría sin PHI**: `safeLog("session.issued", …)` redacta; nunca se loguea el token ni la
  credencial.

## Evidencia

- `pnpm typecheck` PASS · `pnpm test` **200/200** (+6) · `pnpm build:web` PASS
  (`/api/v1/sessions` = `ƒ Dynamic`).
- **Evidencia física EN VIVO contra Neon: PASS 6/6**
  (`scripts/v22/live-session-issuance-proof.mts`):

| Check | Qué prueba |
| --- | --- |
| NO_VERIFIER_503 | Sin verificador configurado → deny-closed |
| LOGIN_201_TOKEN | Aserción válida del IdP dev → sesión firmada emitida |
| **ROUNDTRIP_OPEN_201** | El token emitido **abre un encuentro real** (login→clínica end-to-end) |
| TAMPERED_ASSERTION_401 | Aserción manipulada rechazada |
| WRONG_IDP_SECRET_401 | Aserción firmada por un IdP no confiable rechazada |
| DEV_VERIFIER_DISABLED_IN_PROD_503 | En producción el verificador dev está deshabilitado |

## Despliegue / próximos pasos

- Producción: `POST /api/v1/sessions` responde **503** hasta enchufar un verificador OIDC real
  (Auth0/Clerk/SSO del hospital). El `SESSION_SIGNING_SECRET` ya está listo para firmar las sesiones.
- Cuando exista el verificador real, se ajusta `selectVerifier` (un adapter) y, si se quiere API
  pública, se relaja la Deployment Protection de Vercel.
- La adjudicación de trazabilidad de CAP-IDENTITY-001 sigue pendiente de aceptación humana C5.
