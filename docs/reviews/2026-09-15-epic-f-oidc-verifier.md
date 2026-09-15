# Epic F — Verificador OIDC real (desbloqueo de producción) (15-sep-2026)

Convierte el boundary de sesión (Epic E) en algo **usable en producción**: un verificador
**OIDC/JWT estándar y vendor-neutral** que valida el token del proveedor contra su JWKS y mapea
claims → `VerifiedIdentity`. Funciona con **cualquier IdP compliant** (Auth0, Clerk, SSO del
hospital) configurando solo variables de entorno.

## Por qué así

Verificar JWT en un sistema médico **no se hace a mano** (riesgos clásicos: `alg=none`,
confusión de algoritmo, checks de claims omitidos). Se usa **`jose`** (estándar, auditado, sin
deps nativas). El verificador restringe a **algoritmos asimétricos** (`RS*/PS*/ES*`) — nunca
`HS*`/`none` — y delega la verificación de firma + `iss`/`aud`/`exp` a `jose`.

## Piezas

| Archivo | Rol |
| --- | --- |
| `packages/oidc-verifier/src` | `oidcVerifier(getKey,cfg)` + `mapClaims`: verifica y mapea a `VerifiedIdentity` |
| `apps/web/lib/session-issuance.ts` | `selectVerifier`: OIDC (si `OIDC_ISSUER`+`OIDC_AUDIENCE`) con prioridad y **también en producción** → la desbloquea; `createRemoteJWKSet` cacheado por URI |
| `packages/session-issuance` | `IdentityVerifier` ahora admite verificación **async** |
| `.env.example` | `OIDC_ISSUER/AUDIENCE/JWKS_URI` + claims `tenant/roles/scopes` configurables |

**Mapeo de claims** (defaults, configurables por env): `subject=sub`, `tenantId=tenant_id`,
`roles=roles[]`, `scopes=scope` (OAuth, separado por espacios). Exige `sub`, `tenant` y ≥1 rol —
sin ellos no puede existir una sesión clínica (tenant isolation + authz).

## Prioridad de verificadores (`selectVerifier`)

1. **OIDC real** si `OIDC_ISSUER`+`OIDC_AUDIENCE` → activo **incluido producción**.
2. Verificador de **desarrollo** (Epic E) como fallback local, deshabilitado duro en producción.
3. Nada configurado → **deny-closed (503)**.

## Evidencia

- `pnpm typecheck` PASS · `pnpm test` **209/209** (+9) · `pnpm build:web` PASS.
- **Evidencia física end-to-end: PASS 7/7** (`scripts/v22/live-oidc-login-proof.mts`). El proof
  levanta un **JWKS local** y usa el **mismo `createRemoteJWKSet` de producción** apuntado a ese
  issuer local (fetch remoto real), firma tokens RS256 y valida:

| Check | Qué prueba |
| --- | --- |
| OIDC_LOGIN_201 | Token RS256 válido verificado contra JWKS remoto → sesión emitida |
| **OIDC_ROUNDTRIP_OPEN_201** | La sesión abre un encuentro real (OIDC → clínica end-to-end) |
| EXPIRED_401 · WRONG_AUDIENCE_401 · WRONG_ISSUER_401 | `exp`/`aud`/`iss` verificados |
| UNKNOWN_KEY_401 | Firma con clave ausente del JWKS rechazada |
| MISSING_TENANT_401 | Token sin claim de tenant rechazado |

## Cómo desbloquear producción (pasos del usuario)

1. Elegir/aprovisionar un IdP OIDC (Auth0, Clerk, o el SSO del hospital). Configurar en él el
   **audience** `medical-os` y claims **tenant/roles** (y scopes) en el token.
2. En Vercel (Settings → Environment Variables): `OIDC_ISSUER`, `OIDC_AUDIENCE` (y si aplica
   `OIDC_JWKS_URI` y los nombres de claim). Redeploy.
3. `POST /api/v1/sessions` dejará de dar 503 y emitirá sesiones a partir de tokens del IdP.
4. Si se quiere API pública, relajar la Deployment Protection de Vercel (Standard = solo Preview).

> Nota: falta el **frontend de login** (redirect OIDC → recibir token → llamar a `/api/v1/sessions`).
> El backend ya está listo y probado. La adjudicación C5 de CAP-IDENTITY-001 sigue pendiente.
