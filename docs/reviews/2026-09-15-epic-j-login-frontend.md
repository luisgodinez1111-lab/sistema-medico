# Epic J — Frontend de login (Auth0 SPA → sesión medical-os) (15-sep-2026)

Cierra el flujo de auth de punta a punta desde el navegador: **login con Auth0 (PKCE) → access
token (audience `medical-os`) → intercambio en `/api/v1/sessions` → sesión medical-os firmada →
Bearer a la API clínica.** Vendor-consistente con el verificador OIDC del backend (Epic F).

## Piezas

| Archivo | Rol |
| --- | --- |
| `apps/web/lib/session-client.ts` | Puente navegador: `exchangeForSession`, persistencia por-pestaña (sessionStorage), `authHeader`. **Testeable** (deps inyectables). |
| `apps/web/app/login/page.tsx` | Página de login (client). `@auth0/auth0-spa-js` (PKCE); estados loading/config/anonymous/authenticating/authenticated/error; botón "Probar API clínica". |
| `.env.example` | `NEXT_PUBLIC_AUTH0_DOMAIN/CLIENT_ID` + `NEXT_PUBLIC_OIDC_AUDIENCE` |

- **`@auth0/auth0-spa-js`** (core auditado, sin peer-dep de React → compatible con React 19).
- **Fail-soft:** sin las `NEXT_PUBLIC_*`, la página muestra un aviso de configuración (no rompe).
- **Seguridad:** el token medical-os vive en `sessionStorage` (por-pestaña, no sobrevive al cierre);
  `cacheLocation:"memory"` en Auth0 (no deja el token del IdP en localStorage).

## Evidencia (lo verificable sin navegador)

- `pnpm typecheck` PASS · `pnpm test` **237/237** (+7 puente) · `pnpm build:web` PASS
  (`/login` compila con auth0-spa-js).
- **7/7 tests del puente** (`tests/v22/session-client.test.ts`): parse válido/ inválido, intercambio
  ok, propagación del código de error (401:UNAUTHENTICATED), store/read/clear por-pestaña, sesión
  expirada tratada como ausente, cabecera Authorization.

> El flujo OAuth real (redirect a Auth0 + login humano) requiere navegador + credenciales reales:
> esa parte se prueba en vivo tras la config de Auth0 (abajo). El código está listo.

## Config de Auth0 para que funcione (pasos del usuario)

**Application (SPA)** — Applications → tu app → Settings:
- Allowed Callback URLs: `https://sistema-medico-web.vercel.app/login, http://localhost:3000/login`
- Allowed Logout URLs: `https://sistema-medico-web.vercel.app/login, http://localhost:3000/login`
- Allowed Web Origins: `https://sistema-medico-web.vercel.app, http://localhost:3000`
- Copiar **Domain** y **Client ID**.

**API (el audience)** — Applications → APIs → Create API:
- Identifier = `medical-os` (== `OIDC_AUDIENCE`). Signing RS256. Sin esto el token no lleva
  `aud=medical-os` → 401.

**Action (claims namespaced)** — Actions → Library → Build Custom (Post Login):
```js
exports.onExecutePostLogin = async (event, api) => {
  const ns = "https://medical-os/";
  api.accessToken.setCustomClaim(ns + "tenant_id", event.user.app_metadata?.tenant_id);
  api.accessToken.setCustomClaim(ns + "roles", event.user.app_metadata?.roles || ["PHYSICIAN"]);
};
```
Guardar `tenant_id` y `roles` en el `app_metadata` del usuario de prueba. Deploy + agregar al flujo Login.

**Variables en Vercel:**
| Variable | Valor |
| --- | --- |
| `OIDC_ISSUER` | `https://<DOMAIN>/` (con `/` final) |
| `OIDC_AUDIENCE` | `medical-os` |
| `OIDC_TENANT_CLAIM` | `https://medical-os/tenant_id` |
| `OIDC_ROLES_CLAIM` | `https://medical-os/roles` |
| `NEXT_PUBLIC_AUTH0_DOMAIN` | `<DOMAIN>` |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | `<Client ID>` |
| `NEXT_PUBLIC_OIDC_AUDIENCE` | `medical-os` |

Redeploy → abrir `https://sistema-medico-web.vercel.app/login` → **Entrar con Auth0** → login →
"Probar API clínica" debe mostrar que la sesión es aceptada.
