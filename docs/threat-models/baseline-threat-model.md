# Threat Model — Baseline (STRIDE)

> Autoridad: **ENG-044 / ENG ciclo 3** (¿puede demostrarse confidencialidad, integridad, disponibilidad, trazabilidad y
> aislamiento?). Endurecimiento eje G, Epic BI (2026-09-17). Revisado el 2026-09-22 tras la auditoría del 19-sep (G-05):
> **cada control citado existe en el código y tiene una prueba que lo ejercita**; lo que no existe está en "Brechas".
> Referenciado por `SPEC_INDEX.md` (`docs/threat-models/`).

## Activos protegidos

- **PHI / expediente clínico**: `clinical_events.payload` (única fuente de verdad, ADR-0240), adjuntos y firma/sello en
  Vercel Blob privado.
- **Integridad del registro firmado**: eventos inmutables + cadena de auditoría `audit_chain_v3` (append-only).
- **Identidad y sesión**: identidad OIDC, sesión HMAC en cookie `httpOnly` (ADR-0260), cédula profesional del médico.
- **Aislamiento entre tenants**: RLS forzada con `app.current_tenant()` (ADR-0250).
- **Decisiones clínicas de seguridad**: barreras de prescripción, gate de firma, anulaciones justificadas (ADR-0270).

## Superficie de ataque

| Superficie | Entrada | Confianza |
| --- | --- | --- |
| `/api/v1/**` (Next.js, runtime Node) | JSON validado con zod por handler; `Idempotency-Key` + `If-Match` en escrituras | Ninguna: todo cuerpo es hostil |
| `/login`, `/workspace` (SPA) | Auth0 SPA SDK; cookie de sesión | El navegador no decide nada |
| PostgreSQL (Neon) | Solo desde la app con el rol `medical_os_runtime` (NOBYPASSRLS) | Confianza en el rol, no en el SQL |
| Vercel Blob | Solo vía Functions (`BLOB_READ_WRITE_TOKEN` del servidor) | Privado; nunca URL pública |
| Scripts operativos (`scripts/db`, `scripts/ops`, `scripts/ci`) | Operador con `DATABASE_URL` | Guardas `--yes`, `CI_DB_BOOTSTRAP_ALLOW`, `TEST_DATABASE_URL` |

## STRIDE → controles (con evidencia REAL)

| Amenaza | Vector | Control (dónde) | Evidencia ejecutable |
| --- | --- | --- | --- |
| **S**poofing | Sesión falsificada, token de otro tenant, IdP "dev" en producción | Sesión HMAC verificada en cada petición (`packages/session`); verificador dev deshabilitado por código con `NODE_ENV`/`VERCEL_ENV` de producción; OIDC con issuer + audience + JWKS (`packages/oidc-verifier`) | `tests/v22/runtime-auth-scopes.test.ts`, `tests/security/authz.test.ts`, `scripts/v22/live-session-issuance-proof.mts`; cross-tenant 404 en `live-*-lifecycle-proof.mts` (tenant B no ve agregados de A) |
| **S**poofing (identidad profesional) | Prescribir o firmar sin ser médico habilitado | Rol PHYSICIAN + cédula profesional registrada (428 `PHYSICIAN_CREDENTIALS_REQUIRED`); `actorType` AI nunca prescribe ni firma | `scripts/v22/live-prescription-print-proof.mts`, `live-medication-lifecycle-proof.mts` |
| **T**ampering | Alterar o borrar un evento o una entrada de auditoría | Rol de la app sin `UPDATE`/`DELETE` sobre `clinical_events` y `audit_chain_v3`; huellas encadenadas escritas por `app.append_audit_v17`; verificador que recalcula cada huella en la base (`pnpm audit:verify`) | `scripts/v22/live-audit-chain-verify-proof.mts` (UPDATE/DELETE rechazados; alteración detectada), `tests/v22/audit-verifier.test.ts` |
| **T**ampering (contenido firmado) | Firmar algo distinto de lo mostrado; hora de firma manipulada | Firma con `contentHash` del cliente comparado con lo persistido (409 `SIGNED_CONTENT_MISMATCH`); hora de firma del SERVIDOR | `scripts/v22/live-encounter-lifecycle-proof.mts`, `live-document-lifecycle-proof.mts` |
| **T**ampering (reintentos) | Reusar un `Idempotency-Key` con otro cuerpo | `command_idempotency` + `requestDigest` (409 `IDEMPOTENCY_CONFLICT`) | `tests/v22/session-client.test.ts`; `IDEMPOTENCY_CONFLICT` en `scripts/v22/live-safety-override-proof.mts` y `live-medication-annotations-proof.mts` |
| **R**epudiation | Negar una acción | Cada evento lleva actor, tipo de actor, propósito y correlación; auditoría encadenada; identidad legal (cédula) en PRESCRIBED/SIGNED; anulación de barrera con justificación y autor | `live-safety-override-proof.mts`, `live-audit-chain-verify-proof.mts` |
| **R**epudiation (lecturas) | Negar haber consultado un expediente | `phi_access_log` (0024): actor, sesión, propósito, paciente y momento de cada lectura de PHI identificable, exportación e impresión de receta; append-only para la app (sin UPDATE/DELETE) y RLS forzada | `scripts/v22/live-phi-access-log-proof.mts`, `tests/v22/phi-access-log.test.ts` |
| **S**poofing (sesión revocada) | Reutilizar un token exfiltrado tras el cierre de sesión | Lista de denegación `session_revocations` (0023) consultada dentro de la transacción de cada lectura y en el *preflight* de cada comando; 401 `SESSION_REVOKED` | `scripts/v22/live-session-revocation-proof.mts`, `tests/v22/session-revocation.test.ts` |
| **I**nformation disclosure | Fuga cross-tenant | RLS `ENABLE`+`FORCE` con política de tenant en TODAS las tablas con `tenant_id` (migraciones 0012 y 0020); `pnpm db:check` falla si alguna carece de RLS o de política | `scripts/v21/live-rls-proof.mjs`, `tests/v21/postgres-role-proof.test.ts`, `tests/v22/migrations-integrity.test.ts`, `pnpm db:check` (`scripts/db/check.mts`); cross-tenant 404 en las pruebas de ciclo de vida |
| **I**nformation disclosure | PHI en cachés, `Referer`, terceros, errores | `Cache-Control: no-store` en toda la API; `Referrer-Policy: no-referrer`; CSP sin orígenes externos salvo el IdP; errores con lista cerrada de claves no-PHI (`EXPOSED_DETAILS`) | `tests/v22/security-headers.test.ts`; `EXPOSED_DETAILS` en `apps/web/lib/http-errors.ts` ejercitado por `live-safety-override-proof.mts` y `live-patient-identity-proof.mts` |
| **I**nformation disclosure | PHI en telemetría | SLI sin PHI (allowlist) y sin exportador | `tests/platform/observability.test.ts` |
| **D**enial of service | Fuerza bruta de login, ráfagas de escritura | Límite de tasa: middleware (memoria, por sesión) + almacén compartido `rate_limit_take()` para login por IP y escrituras por actor (429 `RATE_LIMITED`) | `tests/v22/rate-limit.test.ts`, `tests/security/rate-limit.test.ts`, `scripts/v22/live-rate-limit-shared-proof.mts` |
| **D**enial of service | Base indisponible | Fail-closed 503: nunca un "guardado" falso | `tests/v22/downtime-no-false-save.test.ts` |
| **E**levation of privilege | Escalar rol/tenant/scope desde el cliente | Scope obligatorio en `authorize()`, escritura ⇒ lectura y nunca al revés; rol → scopes decididos en el servidor (ADR-0230); RLS no confía en el front | `tests/v22/runtime-auth-scopes.test.ts`, `live-*` con `noScope`/`nurse` |
| **E**levation of privilege | Verticales hospitalarias sin sus datos de seguridad | Flag `ENABLE_HOSPITAL_VERTICALS` OFF por defecto: 404 en sus rutas | `tests/v22/feature-flags.test.ts` |
| Ejecución remota de código | Reglas clínicas evaluadas como texto | Sin `new Function`/`eval`: condiciones tipadas (`RuleContext`) | `tests/v22/clinical-intelligence.test.ts` |
| Inyección HTML | Nombres o indicaciones en la receta impresa | Escapado de todo texto de usuario en `prescription-print`; sin scripts en el HTML | `tests/v22/prescription-print.test.ts` |

## Invariantes de seguridad (no negociables)

- **No frontend authorization** — la autoridad se decide en el servidor.
- **Tenant isolation** como comportamiento de primera clase (RLS forzada, rol NOBYPASSRLS fijado al arrancar cada conexión).
- **Fail-closed** — todo fallo o indisponibilidad se traduce a error, nunca a un éxito silencioso; "no evaluado" nunca es "seguro".
- **Append-only** — eventos y auditoría no se modifican; las correcciones son eventos nuevos.
- **No PHI in telemetry by default** — allowlist.
- **Safety-critical nunca depende de IA generativa** — no hay IA generativa conectada (R6 en pausa); el sobre de seguridad
  de IA bloquea C4/C5 hasta que exista evidencia y aprobación humana reales (L-14).

## Brechas conocidas (honestas, con dueño)

- **Límite de tasa**: login por IP y escrituras por actor usan el almacén compartido (`rate_limit_buckets`, 0021); el
  límite del middleware sigue siendo por instancia (primera línea). Si la base no responde, el límite se degrada al de
  la instancia: acotado, no abierto.
- **CSP**: scripts y elementos de estilo con nonce por petición (`'strict-dynamic'`, `style-src-elem`); los atributos `style` del SSR se permiten con `style-src-attr` (es el mecanismo de estilo de React; no es un vector de ejecución).
- **Auditoría de lecturas: parcial.** Desde la remediación de R01-026 se registra en `phi_access_log` (migración 0024,
  append-only para la app, RLS forzada) quién leyó el expediente, la ficha, los signos vitales o un documento, y quién
  exportó o imprimió una receta, con actor, sesión, propósito y paciente —nunca el contenido—. **No** se registran las
  lecturas agregadas de la clínica (tableros, contadores) ni las consultas internas del servidor; y no existe todavía
  detección automática de patrones de acceso indebido: hoy es evidencia consultable, no una alerta (D-09).
- **Sin *break-glass***: no existe acceso de emergencia auditado a pacientes fuera de la relación asistencial; hoy el
  alcance dentro del tenant es el tenant completo (ADR-0230). Decisión de producto pendiente.
- **Sin borrado ni retención de PHI** más allá del outbox (D-09); sin simulacro de restauración reciente
  (`scripts/v22/restore-drill.mts` existe, requiere un branch desechable).
- **Rotación de secretos** (`SESSION_SIGNING_SECRET`, `BLOB_READ_WRITE_TOKEN`) manual; sin pentest formal.
- **Escaneo de malware de adjuntos**: no hay escáner; los documentos ingeridos quedan `SCAN_PENDING` (L-14).
- **Modelado por integración externa** (laboratorio, PACS, HL7/FHIR) cuando se conecten: hoy no hay ninguna.
