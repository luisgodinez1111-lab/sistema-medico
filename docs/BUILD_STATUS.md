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
Pendiente del gate: Storybook, Command Palette, verificación teclado/touch en 3 tamaños.

**NIVEL 2 — en curso:** paquete `@medical-os/db` con Drizzle ORM. Esquema de
identidad/tenancy (tenant, organization, facility, app_user, membership,
practitioner, role/permission/role_permission/membership_role, relationship
ReBAC) + skeleton de audit/provenance. `TenantContext` resuelto en servidor
(nunca se confía en `tenant_id` del cliente) y repositories tenant-aware con
scoping obligatorio (ADR-0002 §2). Gate parcial cumplido: 7 pruebas
cross-tenant / IDOR / BOLA en verde (`tenant-isolation.test.ts`) contra Postgres
real vía PGlite. Migraciones SQL generadas (`drizzle/0000_*.sql`).
Pendiente del gate: integración con IdP/sesión real, RLS en Neon, wiring de
`authorization_decision_id` en las operaciones sensibles de la app.

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
Pendiente del gate, BLOQUEADO por niveles posteriores: "cambios desde la última
visita" (requiere diff entre encuentros), medicación (NIVEL 8) y pendientes
(NIVEL 9); más el drawer responsive de timeline/rail en tablet/móvil (§21).
NIVEL 4 no puede cerrarse hasta tener N8/N9.

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
| 4     | Patient Workspace                        | 🟨     |
| 5     | Adaptive Clinical History Engine         | 🟨     |
| 6     | Encounter Workspace + firma              | 🟨     |

## Release R2 — Safety Loop

| Nivel | Descripción                              | Estado |
| ----- | ---------------------------------------- | ------ |
| 8     | Medication & Prescription Safety         | 🟨     |
| 9     | Orders, Results y Closed-Loop Safety     | ⬜     |

## Releases posteriores

| Release | Contenido                                | Estado |
| ------- | ---------------------------------------- | ------ |
| R3      | Agenda, check-in, billing básico         | ⬜     |
| R4      | Pathways, completeness, med safety       | ⬜     |
| R5      | Documents, FHIR, external adapters       | ⬜     |
| R6      | AI Copilot (human-in-the-loop)           | ⬜     |
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
9. ⬜ Solicitar un laboratorio
10. ✅ Firmar encuentro (snapshot + provenance)
11. ⬜ Ingresar resultado del laboratorio
12. ⬜ Mostrarlo en Result Inbox
13. ⬜ Marcar revisado + acción + paciente informado
14. ⬜ Cerrar obligación clínica
15. ⬜ Visualizar todo en timeline y audit trail
