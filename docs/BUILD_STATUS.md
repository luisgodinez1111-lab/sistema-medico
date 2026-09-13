# Estado de construcción — Medical OS

Avance por niveles del Plan Maestro (§36) y releases (§29).
Leyenda: ⬜ pendiente · 🟨 en curso · ✅ completo (puerta de salida cruzada)

## Release R0 — Foundation

| Nivel | Descripción                              | Estado |
| ----- | ---------------------------------------- | ------ |
| 0     | Gobierno, repositorio y CI               | ✅     |
| 1     | Design System y arquitectura de info     | 🟨     |
| 2     | Identidad, tenancy y autorización        | 🟨     |
| —     | Audit/provenance skeleton                | ✅     |

**NIVEL 0 — puerta cruzada (2026-09-12):** monorepo pnpm+Turborepo con TS estricto,
ESLint 9, Prettier, husky+lint-staged; ADR-0001/0002/0003; plantillas de issues;
CODEOWNERS; DoD y CHANGELOG; pipeline CI (gitleaks → deps → lint → typecheck → test →
build → CodeQL). `pnpm typecheck/lint/test/build` en verde.

**NIVEL 1 — en curso:** design system (`@medical-os/design-system`) con tokens
theme-aware, primitivas (Button/Badge/Alert/ClinicalCard) y patrones de seguridad
(PatientHeader persistente, AllergyBanner). App Next.js con shell de 3 columnas (§2.1),
Command Center y Patient Workspace navegables con datos sintéticos.
**Command Palette (⌘K / Ctrl+K) listo:** navegación + búsqueda de pacientes
server-side (tenant-scoped vía `/api/patients/search`), accesible por teclado
(flechas/Enter/Esc, `role=dialog`), montado en el layout con pista en el topbar.
**Storybook 9 (react-vite) listo:** stories de las 4 primitivas (Button/Alert/
Badge/ClinicalCard) y los 2 patrones de seguridad (PatientHeader, AllergyBanner),
con tokens+CSS reales cargados en `preview.ts` y **addon a11y** (`test: 'error'`)
alineado con §2.3 (el riesgo nunca solo por color; estados NKDA / "no evaluado"
explícitos). Scripts `storybook` / `build-storybook`; `build-storybook` compila en
verde. Salida estática gitignoreada.
Pendiente del gate: verificación formal teclado/touch en 3 tamaños.

**NIVEL 2 — en curso:** paquete `@medical-os/db` con Drizzle ORM. Esquema de
identidad/tenancy (tenant, organization, facility, app_user, membership,
practitioner, role/permission/role_permission/membership_role, relationship
ReBAC) + skeleton de audit/provenance. `TenantContext` resuelto en servidor
(nunca se confía en `tenant_id` del cliente) y repositories tenant-aware con
scoping obligatorio (ADR-0002 §2). Gate parcial cumplido: 7 pruebas
cross-tenant / IDOR / BOLA en verde (`tenant-isolation.test.ts`) contra Postgres
real vía PGlite. Migraciones SQL generadas (`drizzle/0000_*.sql`).
Wiring de `authorization_decision_id` **completado**: helper `auditedAuthorize`
(server) evalúa el permiso con `decide()` y escribe un `audit_event` (con el
authorization_decision_id y outcome allowed/denied) en cada operación sensible
(prescribir, firmar encuentro, solicitar/revisar estudios). Audit trail por
paciente en `/patients/[id]/audit` (§28 paso 15). Migración `drizzle/0010_*.sql`
(columna `patient_id` en audit_event).
**IdP real — listo (Auth.js v5, email + contraseña):** login propio self-hosted
(sin proveedor externo). Credenciales verificadas contra `app_user` con hash
**bcrypt** (`auth-credentials.ts`: `hashPassword`/`verifyPassword`/`authenticateUser`;
la contraseña nunca en claro, `password_hash` nullable, migración `0014_*.sql`).
Sesión **JWT**; el `uid` firmado viaja en el token y el tenant + permisos se
resuelven server-side (`resolveTenantContextForUser`), NUNCA desde el cliente
(ADR-0002). Split edge-safe: `auth.config.ts` (middleware, sin BD) + `auth.ts`
(Node, Credentials). Middleware protege todo salvo `/login` y `/api/auth`. UI
`/login` + logout en el topbar; el shell solo se muestra autenticado. `context.ts`
lee la sesión real; el fallback demo queda detrás de `AUTH_DEMO_FALLBACK` (solo
dev/tests). Seed fija contraseña del usuario demo (idempotente). 4 pruebas.
**Requiere `AUTH_SECRET` en Vercel** (Production/Preview/Development). MFA/WebAuthn
y tenant-switcher multi-membresía quedan como mejora futura.

Pendiente del gate: **RLS en Neon DIFERIDA** con rationale — el driver neon-http
es stateless (sin sesión/transacción por request), así que el GUC por tenant que
exige RLS no es viable hoy; la defensa en profundidad actual (scoping de repos
obligatorio + constraints + pruebas cross-tenant + audit) es el control primario
aceptado por ADR-0002. Revisar RLS al adoptar un driver con sesión o rol por tenant.

**Audit/provenance skeleton — listo:** tablas `audit_event` (append-only, con
`authorization_decision_id` y `payload` sin PHI) y `provenance`; `AuditRepository`
tenant-scoped con `recordCrossTenantDenied`.

**Cableado app ↔ BD (2026-09-12):** Neon provisionado vía Vercel Marketplace;
13 tablas migradas. `apps/web` consume `@medical-os/db` server-side
(`src/server/db.ts` con `server-only`, `src/server/context.ts` resuelve el
`TenantContext`). `resolveTenantContext` carga permisos efectivos desde la BD
(membership→role→permission). Página `/org` muestra los PRIMEROS datos reales
desde Neon (organización + consultorios) leídos con repositories tenant-aware.
Seed determinista/idempotente (`db:seed`): tenant→org→facility→user→membership→
rol admin+permisos→practitioner. Identidad demo PROVISIONAL hasta el IdP.

**NIVEL 3 — en curso:** tabla `patient` (PHI, ADR-0003): ID interno ULID
separado de identificadores externos (MRN único por tenant, CURP opcional único),
nombre desglosado (convención MX), fecha de nacimiento, sexo, contacto. Borrado
LÓGICO y reversible (`deleted_at`), preparado para merge de duplicados
(`merged_into_id`). `PatientRepository` tenant-aware: detección de duplicados
(CURP como señal fuerte, nombre+fecha como `dedup_key`), búsqueda, soft-delete.
Migración `drizzle/0001_*.sql` aplicada a Neon. 11 pruebas (aislamiento/IDOR,
dedup, soft-delete). Seed con 2 pacientes demo.
`/patients` cableado a Neon: lista + búsqueda (nombre/MRN/CURP) reales, y alta
con flujo de duplicados en la UI (server action con verificación de permiso
`patient.write`, `findDuplicates`, confirmación "crear de todas formas").
Command Center y Patient Workspace (`/patients/[id]`) leen datos reales;
eliminado `mock-data.ts` (sin PHI sintética dispersa).
**Allergy (NIVEL 3):** tabla `allergy` (alineada con FHIR AllergyIntolerance:
substance, category, criticality, reaction, clinical_status) tenant- y
patient-scoped, con baja lógica. `AllergyRepository` valida que el paciente sea
del tenant en cada escritura. Columna `patient.allergies_reviewed_at` para
distinguir "sin alergias conocidas" (NKDA) de "no evaluado" (§27). Migración
`drizzle/0002_*.sql` aplicada a Neon. `AllergyBanner` encendido con datos reales
y criticidad; alta de alergia y marcado NKDA vía server actions (permiso
`patient.write`). 6 pruebas nuevas (aislamiento, patient-scoping, NKDA, soft-delete).
Total db: 24/24 en verde. Seed: María con alergia a Penicilina (alta/anafilaxia),
Santiago NKDA.
**Condition (NIVEL 3):** tabla `condition` (FHIR Condition: code, codeSystem,
clinical_status, onset_date) tenant- y patient-scoped, baja lógica.
`ConditionRepository` valida patient-in-tenant; listActive/listAll, create,
setStatus (p.ej. resolver), softDelete. Migración `drizzle/0003_*.sql` aplicada.
Patient Workspace: "Problemas activos" con datos reales + alta vía server action
(permiso `patient.write`) — cubre §28 paso 7. 5 pruebas nuevas. Seed: María DM2 + HTA.

**Observation / signos vitales (NIVEL 3):** tabla `observation` (FHIR Observation:
category, code, value_text, unit, effective_at) tenant- y patient-scoped, baja
lógica. `ObservationRepository` valida patient-in-tenant; listForPatient (por
categoría), create, softDelete. Migración `drizzle/0004_*.sql` aplicada.
Patient Workspace: tarjeta "Signos vitales" con datos reales + alta vía server
action — cubre §28 paso 6. 5 pruebas nuevas. Seed: María TA 138/86 mmHg + peso 72 kg.

**RelatedPerson (NIVEL 3):** tabla `related_person` (FHIR RelatedPerson: name,
relationship, phone, email, is_emergency_contact) tenant- y patient-scoped, baja
lógica. `RelatedPersonRepository` valida patient-in-tenant; listForPatient
(emergencia primero), create, softDelete. Migración `drizzle/0005_*.sql` aplicada.
Patient Workspace: contactos en el context rail + alta vía server action
(permiso `patient.write`). 4 pruebas nuevas. db: 38/38 verde.
Seed: Santiago (pediátrico) con su madre como contacto de emergencia.

**Merge de duplicados (NIVEL 3, §28 paso 2):** `PatientRepository.merge` fusiona
un duplicado en el superviviente reasignando alergias, problemas, signos vitales
y contactos; marca el duplicado como `merged` + `merged_into_id` con baja lógica
(nunca destructivo, ADR-0003 §8) y hereda la revisión de alergias (NKDA). Como
neon-http no soporta transacciones, la operación es una secuencia de UPDATE
atómicos e IDEMPOTENTES (re-ejecutable). UI en el Patient Workspace (fusionar por
MRN del superviviente, con advertencia; redirige al expediente que sobrevive).
5 pruebas nuevas (reasignación, idempotencia, herencia NKDA, self-merge,
aislamiento tenant). db: 43/43 verde. Verificado contra Neon real.

**NIVEL 3 — Clinical Data Foundation: completo** (patient, allergy, condition,
observation, related_person + merge). Pendiente de releases posteriores:
codificación ICD-10/SNOMED, adjuntos, FHIR export.

**NIVEL 4 — Patient Workspace — en curso:** shell de 3 columnas con datos reales
ya construido en NIVEL 3 (identidad, alergias con criticidad, problemas, signos
vitales, contactos). Añadidos los estados robustos de la DoD (§31):
`loading` (skeletons de lista y workspace), `error` boundary sin PHI (digest para
correlación), `not-found` que no revela existencia cross-tenant (§27).
Timeline **ya vive** (encendido por los encuentros de NIVEL 6): el workspace lista
los encuentros reales con su estado (borrador/firmado) y enlaza a cada nota.
Medicación (NIVEL 8) y resultados/Result Inbox (NIVEL 9) cableados en el
workspace. **Cerrado:** tarjeta "Cambios desde la última visita" (cuenta lo
registrado tras la última nota firmada en alergias/problemas/vitales/medicación/
resultados) y **responsive sin pérdida de contenido** — en tablet/móvil las
columnas de timeline y rail (contactos, auditoría) se APILAN en lugar de ocultarse
(§21). NIVEL 4 completo.

**NIVEL 5 — Adaptive Clinical History Engine — en curso:** historia clínica
ESTRUCTURADA (tabla `history_entry`, una fila por ítem — NUNCA JSON gigante,
§33 #1) tenant- y patient-scoped con baja lógica y unicidad por
(tenant,patient,section,code) para upsert. Motor `applicableHistorySections`
computa server-side las secciones por edad/sexo (adulto: heredofamiliares,
personales patológicos/no patológicos, gineco-obstétricos si mujer; pediátrico:
perinatales, desarrollo <5a, inmunizaciones), con `HISTORY_SCHEMA_VERSION` para
gobernanza (§33 #8). `HistoryRepository.setEntry` hace upsert (valor vacío = baja
lógica). UI `HistoryManager` en el workspace: secciones adaptativas con captura
vía server action (permiso `patient.write`). Migración `drizzle/0006_*.sql`
aplicada. 6 pruebas nuevas (motor adulto/pediátrico/femenino, upsert, vacío,
aislamiento). db: 48/48 verde. Cubre §28 paso 5.
Pendiente: completitud/score de historia, versión de contenido revisada por
clínico, secciones por especialidad (R7).

**NIVEL 6 — Encounter Workspace + firma — en curso:** tabla `encounter` (FHIR
Encounter, nota SOAP estructurada en columnas) tenant- y patient-scoped.
`EncounterRepository`: create (borrador), updateDraft (sólo in-progress), **sign**
(congela snapshot + hash SHA-256 + inserta `provenance`), listForPatient (timeline),
softDeleteDraft. Una nota firmada es **inmutable** (§33 #6): updateDraft/sign/delete
no aplican tras firmar. Firma gated por permiso `encounter.sign` (§NIVEL 2).
UI: botón "Iniciar consulta" funcional en el PatientHeader, ruta
`/patients/[id]/encounters/[eid]` (editor SOAP en borrador; vista inmutable con
hash al firmar), y **timeline real** del workspace listando encuentros.
Migración `drizzle/0007_*.sql` aplicada. 5 pruebas nuevas (borrador/firma/
inmutabilidad/provenance/aislamiento). db: 53/53 verde. Verificado contra Neon.
Cubre §28 pasos 4 y 10.
Pendiente: addenda/enmiendas post-firma, "cambios desde la última visita" (cierra
NIVEL 4), PDF/impresión de la nota.

**NIVEL 8 — Medication & Prescription Safety — en curso (R2):** tabla
`medication_request` (FHIR MedicationRequest: drug, dose, route, frequency,
duration, instructions, link opcional a encounter) tenant- y patient-scoped,
baja lógica. Motor `prescription-safety.ts` con `SAFETY_RULESET_VERSION`: alertas
ESTRUCTURADAS y versionadas (nunca JSX ad-hoc, §33 #8) — `allergy-contraindication`
(crítica, cruza contra alergias del paciente) y `duplicate-therapy` (warning).
`MedicationRepository`: checkSafety, prescribe, listActiveForPatient, stop.
UI `MedicationManager` en el workspace: medicación activa + prescripción; una
alerta crítica bloquea salvo "prescribir de todas formas" (confirmación explícita).
Permiso `patient.write`. Migración `drizzle/0008_*.sql` aplicada. 7 pruebas nuevas
(motor crítico/duplicado/limpio, checkSafety real, prescribe, aislamiento, stop).
db: 60/60 verde. Verificado contra Neon (Penicilina→crítica). Cubre §28 paso 8 y
enciende la tarjeta "Medicación" del NIVEL 4.
Pendiente: interacciones fármaco-fármaco, dosis por peso/edad (pediátrico),
catálogo de medicamentos, receta imprimible.

**NIVEL 9 — Orders, Results & Closed-Loop Safety — en curso (R2):** tablas
`service_request` (orden lab/imagen/procedimiento) y `diagnostic_report`
(resultado + ciclo de revisión), tenant- y patient-scoped, baja lógica.
`ServiceRequestRepository` (solicitar, estado) y `DiagnosticReportRepository`
(enterResult → completa la orden; listPendingReview = **Result Inbox** por tenant;
markReviewed = cierra obligación con acción + paciente informado). Resultados
críticos con flag visible (§27). UI: `OrdersManager` en el workspace (solicitar
estudio, ingresar resultado, revisar/cerrar) y **Result Inbox real** en el Command
Center. Permiso `patient.write`. Migración `drizzle/0009_*.sql` aplicada.
4 pruebas nuevas (ciclo completo, inbox aislado, scoping de orden/resultado,
revisión sin cruce de tenant). db: 64/64 verde. Verificado contra Neon.
Cubre §28 pasos 9, 11-14.
Pendiente: notificación/tareas, resultados estructurados (LOINC), adjuntos,
escalamiento de críticos.

**Release R3 — Agenda + check-in — en curso:** tabla `appointment` (FHIR
Appointment) en módulo `schema/scheduling.ts` **separado de lo clínico** (§33
#11), tenant- y patient-scoped, baja lógica. `AppointmentRepository`: create,
listForDay/listForPatient, **checkIn** (booked→arrived sella `arrived_at`),
setStatus (cancelar/no-show/atendida). Migración `drizzle/0011_*.sql` aplicada.
UI `/agenda` (enlazada en el topbar): agenda del día por fecha con check-in y
cancelar, alta de cita por MRN; permiso `patient.write`. 4 pruebas nuevas
(crear/listar por día, check-in no reaplicable, aislamiento). db: 68/68 verde.
Verificado contra Neon (booked→check-in→arrived).
**Billing básico (R3):** módulo `schema/billing.ts` SEPARADO de lo clínico
(§33 #11): `invoice` + `invoice_item`, dinero en CENTAVOS enteros, moneda
explícita (MXN). `BillingRepository`: createInvoice (líneas + total derivado),
getItems, listForPatient, issue (draft→issued), markPaid (issued→paid), todo
tenant/patient-scoped. Migración `drizzle/0012_*.sql` aplicada. UI
`/patients/[id]/billing` (enlace en el rail): lista de facturas con estado,
alta de factura y acciones emitir/pagar; permiso `patient.write`. Helper
`formatMoney`/`pesosToCents`. 4 pruebas nuevas (total, validación, transiciones,
aislamiento). db: 72/72 verde. Verificado contra Neon ($1,100.00 draft→issued→paid).

**Release R3 — Agenda + check-in + billing básico: completo.**
Pendiente de mejoras R3: recordatorios, anti doble-booking por practitioner,
vista semanal de agenda, facturas multi-línea en UI, impresión/CFDI.

**Release R4 — Completeness — en curso:** motor `computeCompleteness`
(`completeness.ts`) con `COMPLETENESS_RULESET_VERSION` (gobernanza, §33 #8):
score 0-100 y checklist del expediente mínimo (alergias evaluadas, historia
capturada, signos vitales, contacto, encuentro) calculado de datos existentes
(sin tabla nueva; "no evaluado" cuenta como faltante, §27). Medidor + checklist
en el context rail del workspace (`role=meter`, accesible). 3 pruebas. db: 75/75.
**Med-safety avanzada (R4):** el motor `prescription-safety` añade interacciones
fármaco-fármaco (código `drug-interaction`) con **catálogo DEMO marcado**
(`INTERACTIONS_SOURCE = 'DEMO (no validado clínicamente)'`,
`INTERACTIONS_DATASET_VERSION`); cada alerta lleva `source: 'rule' | 'demo'` y la
UI marca las DEMO. **Sustituir por una base licenciada + reviewer antes de uso
real** (§33 #8, DoD). 1 prueba nueva. db: 76/76. Verificado contra Neon
(warfarina+ibuprofeno → crítica/demo).
**Pathways / guías de manejo (R4):** motor `applicablePathways` (`pathways.ts`)
con `PATHWAYS_VERSION`/`PATHWAYS_SOURCE = 'DEMO (no validado clínicamente)'`:
según los problemas activos sugiere ítems de seguimiento (DM2→HbA1c/pies/fondo de
ojo; HTA→TA/creatinina). Sólo recomienda; no marca cumplimiento automático (§27).
Tarjeta "Guías de manejo (DEMO)" en el workspace. 3 pruebas. db: 79/79.
**Sustituir catálogo por guías aprobadas + reviewer antes de uso real** (§33 #8).

**Release R4 — Pathways + completeness + med-safety avanzada: completo**
(med-safety y pathways con contenido DEMO marcado, a validar).
Pendiente: dosis por peso/edad (catálogo), cumplimiento de guías vs datos reales.

**Release R5 — Exportador FHIR — en curso:** módulo `fhir.ts` (R4 FHIR_VERSION
4.0.1): mapea Patient, AllergyIntolerance, Condition, Observation,
MedicationRequest, Encounter, ServiceRequest, DiagnosticReport y arma un Bundle
`collection`. Endpoint `/api/patients/[id]/fhir` tenant-scoped (content-type
`application/fhir+json`, no-store, 404 sin revelar existencia cross-tenant);
enlace "Exportar FHIR (R4)" en el workspace. 5 pruebas. db: 84/84. Verificado
contra Neon (Bundle con 6 recursos).
**Documents (R5):** tabla `clinical_document` en módulo separado: guarda SOLO
metadata + content hash + storage key; **nunca los bytes ni URLs públicas**
(ADR-0003 §10, §33 #5). `DocumentRepository`: register (pending-upload),
markStored (sella hash+clave cuando haya storage), listForPatient, softDelete.
Migración `drizzle/0013_*.sql`. UI `/patients/[id]/documents` (enlace en el rail):
lista + registro de metadata; `DOCUMENTS_STORAGE` (env) define el proveedor,
hoy `unconfigured` → los documentos quedan "pendientes de carga". 3 pruebas.
db: 87/87. Verificado contra Neon.
**Object storage privado (R5 — completado):** módulo `storage.ts` con el puerto
`StorageProvider` y URLs prefirmadas **AWS SigV4** (compatible S3 / Cloudflare R2
/ Backblaze B2 / MinIO) implementadas con `node:crypto` — sin SDK ni dependencias.
`NullStorageProvider` = `unconfigured` (nunca inventa URLs, devuelve precondición);
`S3StorageProvider` firma PUT/GET de corta duración (5 min). `resolveStorageProvider`
lee `STORAGE_S3_*` del entorno. Los bytes **nunca pasan por el servidor**: el
cliente sube con un PUT prefirmado y calcula el SHA-256 en el navegador; el
servidor sella hash+clave+tamaño (`finalizeDocument`) y audita cada fase
(presign-upload / stored / download). Descarga vía proxy autorizado
`/api/patients/[id]/documents/[docId]/download` → redirect 302 a GET prefirmado.
UI: botón "Subir archivo" (pendientes, si hay storage) y "Descargar" (almacenados).
9 pruebas de firma determinista.

**Importación FHIR / adaptadores externos (R5 — completado):** módulo
`fhir-import.ts` — mapeo de ENTRADA (inverso de `fhir.ts`): `parseFhirPatient`,
`parseFhirAllergy`, `parseFhirCondition`, `parseFhirObservation`, `parseFhirBundle`.
Puro y read-only; devuelve create-inputs internos (sin `patientId`) vía `Result`,
con validación explícita y conteo de recursos no soportados (`skipped`). Surface:
`POST /api/patients/[id]/fhir` importa un Bundle SOBRE un paciente ya resuelto del
tenant (el recurso Patient se ignora para evitar alta ciega/duplicados), audita
conteos sin PHI. 13 pruebas, incluye round-trip export→import.

**Release R5 — Documents + FHIR (export + import) + object storage: COMPLETO ✅.**
Único paso externo: aprovisionar el bucket y setear `STORAGE_S3_*` en Vercel.

**Release R6 — AI Copilot (human-in-the-loop) — en curso:** andamiaje `ai-copilot.ts`
(`AI_ENGINE='stub-demo (no IA)'`, `AI_POLICY_VERSION`): contexto MÍNIMO y sin PHI
de identidad (solo problemas + alergias, §33 #9), sugerencias estructuradas. La IA
SUGIERE, el clínico decide — **no escribe nada al expediente** (§14). Cada
generación registra **provenance de IA** (engine/policy/contextHash, sin
chain-of-thought ni PHI) en `audit_event`. UI `CopilotPanel` en el workspace con
marca "DEMO (no IA)". 4 pruebas. db: 91/91. Verificado contra Neon.
**R6 EN PAUSA (decisión del equipo, 2026-09-13):** el núcleo human-in-the-loop
queda entregado y estable, pero la conexión a IA real (Claude vía AI Gateway de
Vercel detrás de env var) se **deja pendiente hasta determinar el paso adecuado**
(proveedor, política de datos y contrato definitivo). No se avanza R6 hasta esa
definición; el contrato actual (contexto mínimo + provenance + human-in-the-loop)
se mantiene listo para enchufar el motor real sin cambios.

## Deuda de upgrades (majors pendientes, evaluar deliberadamente)

Dependabot ahora agrupa minor/patch e **ignora majors** (política de estabilidad,
`.github/dependabot.yml`). Majors a abordar uno a uno, con prueba contra el código
real (no merge a ciegas):

- **next 15 → 16** — framework de la app; revisar breaking changes.
- **@neondatabase/serverless 0.10 → 1.1** — driver de BD; verificar runtime.
- **ulid 2 → 3** — falló typecheck (probable ESM-only/API); requiere ajuste.
- **zod 3 → 4** — aún sin uso real en código; bajo valor hasta que se use.
- **dev-tooling**: TypeScript, ESLint 10, Vitest 5 — grupo que falló; por separado.

Ya aplicados (deliberados): drizzle-orm 0.45 (con fix de `isUniqueViolation`),
GitHub Actions (checkout v7, setup-node v7, pnpm v6, codeql v4, gitleaks v3).

## Release R1 — Clinical Core

| Nivel | Descripción                              | Estado |
| ----- | ---------------------------------------- | ------ |
| 3     | Clinical Data Foundation                 | ✅     |
| 4     | Patient Workspace                        | ✅     |
| 5     | Adaptive Clinical History Engine         | 🟨     |
| 6     | Encounter Workspace + firma              | 🟨     |

## Release R2 — Safety Loop

| Nivel | Descripción                              | Estado |
| ----- | ---------------------------------------- | ------ |
| 8     | Medication & Prescription Safety         | 🟨     |
| 9     | Orders, Results y Closed-Loop Safety     | 🟨     |

## Releases posteriores

| Release | Contenido                                | Estado |
| ------- | ---------------------------------------- | ------ |
| R3      | Agenda, check-in, billing básico         | ✅     |
| R4      | Pathways, completeness, med safety       | ✅     |
| R5      | Documents, FHIR export+import, storage   | ✅     |
| R6      | AI Copilot (núcleo ✅; IA real EN PAUSA)  | ⏸️     |
| R7      | Specialty packs                          | ⬜     |

## Vertical slice objetivo (§28)

El primer corte end-to-end que valida la columna vertebral:

1. 🟨 Crear tenant, organización, consultorio y médico (vía seed; falta flujo UI)
2. ✅ Crear/buscar paciente con detección de duplicados (UI + server action)
3. ✅ Abrir Patient Workspace (identidad, alergias, problemas, vitales, contactos reales)
4. ✅ Crear encuentro de medicina general
5. 🟨 Capturar historia adaptativa adulto/pediátrico mínima (motor + captura listos)
6. 🟨 Registrar signos vitales y exploración (vitales listos; exploración pendiente)
7. 🟨 Crear problema/diagnóstico y plan (Condition listo; plan pendiente)
8. 🟨 Emitir receta estructurada (prescripción + seguridad; falta receta imprimible)
9. ✅ Solicitar un laboratorio
10. ✅ Firmar encuentro (snapshot + provenance)
11. ✅ Ingresar resultado del laboratorio
12. ✅ Mostrarlo en Result Inbox
13. ✅ Marcar revisado + acción + paciente informado
14. ✅ Cerrar obligación clínica
15. ✅ Visualizar todo en timeline y audit trail (timeline de encuentros + `/patients/[id]/audit`)
