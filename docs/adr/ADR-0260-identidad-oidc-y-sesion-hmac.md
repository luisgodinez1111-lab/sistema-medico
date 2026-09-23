# ADR-0260 — Identidad por OIDC (Auth0/SSO) y sesión clínica propia firmada con HMAC en cookie `httpOnly`
Status: ACEPTADO (2026-09-22) — documenta la decisión vigente (EPIC E/F/J/L; auditoría G-07, S-01/S-02 en ADR-0230)

## Contexto

El sistema necesita (a) identidad verificable del profesional, (b) una sesión con tenant, roles y scopes decididos por
el servidor y (c) que la API sea llamable desde el cockpit sin exponer tokens a JavaScript. Un JWT del IdP no sirve
directamente: no lleva la política de scopes del sistema ni el `purpose`, y su vida la controla el IdP.

## Decisión

1. **Verificación de identidad** por OIDC (`packages/oidc-verifier`): issuer + audience + JWKS. Con `OIDC_ISSUER` y
   `OIDC_AUDIENCE` definidos es el único verificador válido en producción. El verificador "dev" (`AUTH_MODE=development`
   + `ALLOW_DEV_IDENTITY` + `DEV_IDENTITY_SECRET`) está deshabilitado por código cuando `NODE_ENV`/`VERCEL_ENV` son de
   producción.
2. **Sesión propia** (`packages/session`, `packages/session-issuance`): claims `{sub, tenantId, roles, scopes, purpose,
   iat, exp, sessionId}` firmadas con HMAC-SHA256 y `SESSION_SIGNING_SECRET`; **15 minutos** de vida (mínimo
   privilegio; el cliente renueva). Los scopes los asigna el **servidor** a partir del rol (`ROLE_SCOPES`, ADR-0230); el
   IdP aporta identidad y roles, nunca permisos.
3. **Transporte:** cookie `medos_session` con `httpOnly`, `secure` (siempre), `sameSite=lax`, `path=/` y `maxAge` igual
   a la vida de la sesión (`apps/web/lib/session-issuance.ts`). `lax` y no `strict` porque el retorno desde el IdP es una
   navegación de nivel superior; las escrituras exigen además `Idempotency-Key` e `If-Match`, y la CSP limita
   `form-action` a `'self'`, lo que acota el CSRF. La API acepta también `Authorization: Bearer` (pruebas y clientes no
   navegador). El navegador nunca lee el token.
4. **Actor clínico:** el `sub` del IdP (no necesariamente UUID) se convierte en un UUID determinista por sesión
   (`http-principal`), que es el `actor_id` de eventos y auditoría; el `sub` crudo se conserva en las claims.
5. **Contexto por petición:** `resolveVerified(req)` produce `{tenantId, actorId, actorType, purpose, requestId}`; es lo
   único que llega a la base (RLS) y al kernel. El `actorType` de la IA es `AI` y nunca puede prescribir ni firmar
   (Physician Control); prescribir y firmar exigen además cédula profesional registrada (L-05, lote 9b).
6. **Límite de tasa** en memoria por instancia (login por IP, escrituras por sesión) con `Retry-After`; la CSP y las
   cabeceras de seguridad se fijan en `apps/web/next.config.mjs` para toda respuesta.

## Consecuencias

- Rotar `SESSION_SIGNING_SECRET` invalida todas las sesiones (15 min de impacto máximo).
- El límite de tasa de login y de escrituras usa un almacén compartido en Postgres (0021); el del middleware es por instancia.
- La CSP de las páginas lleva nonce por petición para scripts (`'strict-dynamic'`); `style-src` conserva `'unsafe-inline'`
  hasta que los estilos pasen a clases (S-04).
