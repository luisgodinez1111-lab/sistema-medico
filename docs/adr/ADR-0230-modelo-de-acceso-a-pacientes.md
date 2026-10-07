# ADR-0230 — Modelo de acceso a pacientes dentro del tenant y modelo de scopes
Status: ACEPTADO (2026-09-22) — remediación de la auditoría del 19-sep-2026 (hallazgos S-01, S-02)


> **Decidido por:** la remediación de la auditoría del 19-sep-2026, bajo la autorización del dueño del repositorio. El
> lote que lo introdujo y su hash están en `docs/reviews/2026-09-20-remediacion-auditoria.md`, así que la decisión es
> **rastreable a un cambio concreto** — a diferencia de los 25 ADR heredados, cuyo decisor no consta en ninguna parte.
> **Alternativas consideradas:** las que el apartado «Decisión» descarta explícitamente más abajo.

## Contexto

La auditoría encontró que `authorize()` recibía `{tenantId, role?, scope?, purpose?}` con los tres últimos
**opcionales** (una llamada sin `scope` autorizaba a cualquier persona del tenant), que nunca recibe un
`patientId` (no existe relación médico–paciente ni *break-glass*: los paquetes `break-glass*` no tienen
importadores), y que 13 de 26 lecturas exigían el scope de **escritura** del recurso, con lo que era imposible
un rol de solo lectura (auditoría interna, recepción, consulta externa).

Tres preguntas distintas se mezclaban ahí:

1. ¿Qué puede hacer una sesión? (scopes: lectura / escritura por recurso)
2. ¿Sobre qué pacientes? (alcance dentro del tenant)
3. ¿Quién decide y cómo se demuestra? (auditoría y accesos excepcionales)

## Decisión

### 1. Scopes: obligatorios, por recurso y con jerarquía en un solo sitio

- `authorize()` exige `scope` **siempre**. No existe la autorización "solo por tenant"; un llamador sin scope
  falla cerrado (`INVARIANT_VIOLATION`), nunca abierto.
- Cada recurso tiene `<recurso>:read` y `<recurso>:write` (más `medication:propose` y `record:export`).
- Un scope de escritura **implica** el de lectura del mismo recurso; el inverso, nunca. La implicación vive en
  `packages/runtime-auth` (`hasScope`) y en ningún otro lugar. Consecuencias:
  - Las sesiones ya emitidas (roles con scopes de escritura) siguen funcionando sin cambios.
  - Las rutas piden el scope **mínimo**: toda lectura pide `:read`.
  - Existe un rol de solo lectura (`AUDITOR`, en `packages/session-issuance`) que no puede escribir nada.
- La política rol → scopes es del **servidor** (`ROLE_SCOPES`); el IdP aporta identidad y roles. Ampliar los
  permisos de un rol es un cambio de código revisable, no una configuración silenciosa en el IdP.

### 2. Alcance dentro del tenant: el tenant es la unidad de confianza (por ahora)

Un tenant es **un consultorio o una clínica pequeña**. Todo clínico del tenant con el scope correspondiente
puede acceder a **todos** los pacientes del tenant. Razones:

- Es el modelo real de un consultorio de 1–5 clínicos que comparten pacientes (suplencias, urgencias,
  enfermería): una relación médico–paciente estricta bloquearía la atención habitual y produciría *break-glass*
  constante, que es un mecanismo para excepciones, no para el día a día.
- El aislamiento **entre** tenants sí es absoluto: RLS en base de datos con `app.tenant_id` de los *claims*,
  nunca del cuerpo (ver ADR-0170).
- Cada **escritura** queda en la cadena de auditoría inmutable con actor, propósito y recurso (ADR-0170), y desde la
  remediación del hallazgo R01-026 cada **lectura de PHI identificable** (expediente, ficha, signos vitales, documento,
  exportación y receta impresa) deja constancia en `phi_access_log` (migración 0024) con actor, sesión, propósito,
  paciente y momento —nunca el contenido leído—. Eso es lo que permite la detección *a posteriori* de accesos indebidos,
  que es el control principal en clínicas pequeñas.
  Corrección honesta: hasta 2026-09-23 esta línea afirmaba que «cada acceso» quedaba en la cadena de auditoría, lo que
  solo era cierto para las escrituras. Lo que sigue SIN registrarse son las lecturas agregadas de la clínica (tableros y
  contadores, que no identifican a un paciente) y las consultas internas del servidor para decidir una barrera.

Lo que este ADR **no** resuelve y queda registrado como deuda explícita:

- Relación médico–paciente y listas de pacientes asignados (necesario cuando un tenant sea una institución
  con decenas de clínicos o varias sedes).
- *Break-glass* con justificación, notificación y revisión.
- Consentimiento del paciente para compartir dentro del tenant.

Estos tres puntos se diseñarán cuando aparezca el primer tenant que los requiera; el punto de extensión es
único (`authorize()` recibirá un `patientId` opcional y una política de alcance) y no exige rehacer las rutas.

### 3. Propósito

El `purpose` de la sesión (`TREATMENT`, `OPERATIONS`, `BILLING`, `RESEARCH`) sigue siendo un tercer eje: las
rutas clínicas exigen `TREATMENT`. Un uso secundario de los datos (facturación, investigación) requiere su
propio propósito y, en el futuro, su propia base legal documentada.

## Consecuencias

- **Positivas:** ninguna ruta autoriza sin scope; roles de solo lectura posibles; la jerarquía está en un
  único módulo con tests; el alcance por tenant queda escrito y justificado en lugar de implícito.
- **Negativas / riesgos:** en un tenant grande el modelo "todos ven a todos" es insuficiente; el registro de
  auditoría es el control compensatorio hasta que exista la relación médico–paciente.
- **Verificación:** `tests/v22/runtime-auth-scopes.test.ts` (jerarquía, fail-closed, rol AUDITOR) y las
  pruebas en vivo, que emiten sesiones con scopes explícitos y comprueban 403 sin ellos.

## Referencias

- Auditoría del repo (19-sep-2026), hallazgos S-01, S-02; anexo R04.
- ADR-0170 (autoridad transaccional y auditoría), SPEC_INDEX (tenant isolation, provenance, audit).
- `packages/runtime-auth/src/index.ts`, `packages/session-issuance/src/index.ts`.
