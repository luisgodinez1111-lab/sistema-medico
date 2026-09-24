# Runbook — Rotación de secretos
> Autoridad: auditoría 2026-09-19, anexo R09 (R09-033). Gobierno operativo.
> Este runbook trata **nombres** de variables y procedimientos. Ningún valor de secreto se escribe aquí, ni en el repo, ni
> en un commit, ni en un mensaje de incidente: el repositorio no contiene secretos y `.env.local` no se versiona.

## 0. Inventario de secretos (por nombre)

| Variable | Qué protege | Efecto de rotarla | Quién la emite |
| --- | --- | --- | --- |
| `DATABASE_URL` | Conexión a Postgres con el rol de la aplicación | Reconexión; el pool se rehace | Proveedor de la base (Neon) |
| `SESSION_SIGNING_SECRET` | Firma HMAC de la sesión (ADR-0260) | **Invalida todas las sesiones vivas**: todo el mundo vuelve a entrar | Propio |
| `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URI` | Verificación del token de identidad | Si queda mal, nadie entra (falla cerrado) | Proveedor de identidad |
| `OIDC_TENANT_CLAIM`, `OIDC_ROLES_CLAIM`, `OIDC_SCOPES_CLAIM` | De qué claim salen tenant, roles y scopes | Cambia la autorización: se prueba antes | Propio (acuerdo con el IdP) |
| `NEXT_PUBLIC_*` | Configuración del cliente | **No son secretos**: viajan al navegador por diseño. Nunca poner un secreto con este prefijo | Propio |
| `TEST_DATABASE_URL` | Base DESECHABLE de las pruebas en vivo | Ninguno en producción | Propio |

## 1. Regla que no se negocia

`SESSION_SIGNING_SECRET` y `DATABASE_URL` **nunca** se leen, se copian a un chat, se pegan en un ticket ni se imprimen en
un log. Si un secreto pasó por un canal que no controlas, ya está comprometido: se rota, no se discute.

## 2. Rotación planificada

1. **Anuncia la ventana** si vas a rotar `SESSION_SIGNING_SECRET`: cierra la sesión de todo el mundo, y en consulta eso
   interrumpe a un médico a media nota. Hazlo fuera de horario clínico.
2. **Emite el valor nuevo** en el proveedor (Neon para la base, el IdP para OIDC; propio para la firma de sesión).
3. **Cárgalo en el entorno de despliegue** (Vercel: variables del proyecto). No lo pases por el repositorio.
4. **Despliega** y comprueba en este orden:
   - `pnpm db:check` con la nueva `DATABASE_URL` → esquema, políticas y migraciones sin deriva;
   - un inicio de sesión real → verifica la cadena OIDC completa;
   - una escritura clínica real → verifica que el rol de la aplicación conserva sus privilegios.
5. **Retira el valor anterior** en el proveedor. Un secreto rotado que sigue siendo válido no está rotado.

## 3. Rotación de emergencia (sospecha de exposición)

1. **Revoca antes de rotar.** Sesiones: `session_revocations` (migración 0023), que se consulta dentro de la transacción de
   cada comando. Base: retira el acceso del rol comprometido en el proveedor.
2. **Rota** siguiendo §2, sin ventana: la interrupción es preferible a la exposición.
3. **Busca el alcance** con `phi_access_log` (migración 0024): qué expedientes se leyeron, cuándo y con qué propósito.
4. **Abre un incidente** con el runbook de incidente y cierra con un gate, no con un mensaje de commit.

## 4. Cadencia y lo que falta

- **Cadencia propuesta:** OIDC y base según la política del proveedor; `SESSION_SIGNING_SECRET` al menos una vez al año y
  en cada baja de personal con acceso al entorno de despliegue.
- **PENDIENTE DE DECISIÓN DEL DUEÑO:** la cadencia contractual, quién custodia los secretos y si se adopta un gestor
  dedicado. Hoy viven en las variables del proyecto de despliegue, y eso es una decisión de infraestructura, no de código.
- **No existe** rotación automatizada ni alerta de caducidad. Decirlo es parte de no presentar una falla abierta como
  control: si nadie la hace a mano, no se hace.
