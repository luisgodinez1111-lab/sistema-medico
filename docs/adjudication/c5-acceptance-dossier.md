# Dossier de aceptación C5 — Medical OS V2

**Generado automáticamente** por `scripts/v22/build-c5-dossier.mts`. NO es autoridad: es el paquete de evidencia
para que un revisor humano C5 acepte (o rechace) cada capacidad reconciliada. La aceptación se registra firmando la tabla al final.

- Capacidades reconciliadas: **150**
- Estado de evidencia: **NO RESPALDADA ❌ (310 problemas)**
  - Libro de pruebas unitarias: **AUSENTE** — sin él no se puede afirmar que la evidencia se haya ejecutado
  - Libro de pruebas en vivo: **AUSENTE**
- Cobertura declarada: **150 capacidades reconciliadas**. El registro de capacidades del repositorio tiene más (ver `pnpm capability:check`); las que no aparecen aquí NO están respaldadas por este dossier y no pueden presentarse como aceptadas.
- Pendiente de aceptación humana C5: **116**
- Sin evidencia EJECUTABLE propia (evidencia en prosa): **53**

## ⚠ Capacidades SIN evidencia ejecutable propia

Estas **53** capacidades no citan ningún artefacto que se pueda ejecutar: su evidencia es una
descripción en prosa (reutilización de otras capacidades, módulo presentacional, etc.). No se pueden presentar como
respaldadas por una ejecución, y el revisor humano C5 tiene que decidirlas mirando el código, no el libro.

- CAP-AUTHZ-001 — Tenant/Role/Scope/Purpose Authorization
- CAP-UUID-BOUNDARY-001 — Strict UUID Persistence Boundary
- CAP-APP-001 — Clinical Application Service Layer
- CAP-PATIENT-STATE-002 — Computed Patient State Composer (resumen del paciente)
- CAP-CLINICAL-INTELLIGENCE-UI-001 — Clinical Intelligence — alertas y calculadoras deterministas (IA generativa R6 en pausa)
- CAP-CLINICAL-LIBRARY-UI-001 — Biblioteca Clínica — repositorio de conocimiento (referencia) con herramientas reales enlazadas
- CAP-SETTINGS-UI-001 — Configuración — ajustes/preferencias del consultorio (presentacional)
- CAP-PATIENTS-UI-001 — Pacientes — búsqueda/filtros reales + creador inline + interconexión (Agenda/expediente)
- CAP-CONSULTA-ENCOUNTER-UI-001 — Consulta — documentación cableada al encuentro REAL (abrir → valorar → firmar, con gate de firma)
- CAP-INICIO-DASHBOARD-UI-001 — Inicio — dashboard interconectado por contexto de paciente + KPIs de la agenda real
- CAP-CONSULTA-VITALS-UI-001 — Consulta — signos vitales cableados a POST /vitals (con interpretación crítica y gate de firma)
- CAP-CONSULTA-ORDERS-UI-001 — Consulta — crear órdenes clínicas reales desde el formulario (POST /orders)
- CAP-CONSULTA-PROBLEMS-UI-001 — Consulta — agregar diagnósticos CIE-10 reales a la lista de problemas (POST /problems)
- CAP-CONSULTA-ANTECEDENTES-UI-001 — Consulta — antecedentes marcados se componen en la nota del encuentro (persisten al firmar)
- CAP-ALLERGIES-CREATE-UI-001 — Alergias — registro inline real desde el módulo (POST /allergies), alimenta el gate de prescripción
- CAP-IMMUNIZATIONS-CREATE-UI-001 — Vacunas — registro inline real (POST /immunizations; administra si hay lote+sitio)
- CAP-CAREPLAN-CREATE-UI-001 — Plan de cuidado — agregar metas reales al plan del paciente (POST /care-plans)
- CAP-DOCUMENTS-CREATE-UI-001 — Documentos — crear documento clínico real desde el módulo (POST /documents)
- CAP-REGULATORY-OBLIGATIONS-CREATE-UI-001 — Obligaciones — alta inline real de obligaciones regulatorias del consultorio (POST /regulatory-obligations)
- CAP-BILLING-PATIENT-UI-001 — Facturación — emisión real con selector de paciente cableado (POST /claims)
- CAP-REFERRALS-PATIENT-UI-001 — Interconsultas — envío real con selector de paciente cableado (POST /referrals)
- CAP-RESULTS-CREATE-UI-001 — Resultados — registrar resultado real con interpretación derivada por CDS (POST /results)
- CAP-VITALS-MODULE-PATIENT-UI-001 — Signos vitales — registro por módulo con selector de paciente cableado (POST /vitals)
- CAP-CONSULTA-PANEL-UI-001 — Consulta — panel de consultas del día; el workspace se abre al elegir paciente/cita
- CAP-CONSULTA-AUDIT-DEEP-001 — Consulta — auditoría boton por boton: cero controles muertos/cosméticos en el workspace
- CAP-AGENDA-AUDIT-DEEP-001 — Agenda — auditoría boton por boton: rejilla y contadores 100% reales (sin citas de ejemplo)
- CAP-RESULTADOS-AUDIT-DEEP-001 — Resultados — auditoría boton por boton: navegador real (filtros/lista/detalle) sin maqueta ni datos falsos
- CAP-MEDICAMENTOS-AUDIT-DEEP-001 — Medicamentos — auditoría boton por boton: catálogo/interacciones/alertas 100% reales (confirmado)
- CAP-ORDENES-AUDIT-DEEP-001 — Órdenes — auditoría boton por boton: KPIs y distribución 100% reales (sin fallback ficticio)
- CAP-ALERGIAS-AUDIT-DEEP-001 — Alergias — auditoría boton por boton: registro real, cero controles muertos, fix de navegación
- CAP-PROBLEMAS-AUDIT-DEEP-001 — Problemas — auditoría boton por boton (pantalla lista): registro real, cero controles muertos, fix de navegación
- CAP-VACUNAS-AUDIT-DEEP-001 — Vacunas — auditoría boton por boton: registro real, cero controles muertos, fix de navegación
- CAP-SIGNOS-AUDIT-DEEP-001 — Signos vitales — auditoría boton por boton: historial/tendencias reales, form solo con campos persistidos
- CAP-PLANCUIDADO-AUDIT-DEEP-001 — Plan de cuidado — auditoría boton por boton: solo el espinazo real del snapshot, sin maqueta
- CAP-INTERCONSULTA-AUDIT-DEEP-001 — Interconsultas — auditoría boton por boton: contexto real, resumen persistido, sin maqueta
- CAP-SEGUIMIENTO-AUDIT-DEEP-001 — Seguimiento — auditoría boton por boton: solo el espinazo real del snapshot, sin maqueta
- CAP-FACTURACION-AUDIT-DEEP-001 — Facturación — auditoría boton por boton: registro real, creador honesto, sin gráficas ni fiscales ficticios
- CAP-DOCUMENTOS-AUDIT-DEEP-001 — Documentos — auditoría boton por boton: registro real, carpetas que filtran, sin PDF inventado
- CAP-OBLIGACIONES-AUDIT-DEEP-001 — Obligaciones — auditoría boton por boton: registro real, tabs que filtran, sin secciones ficticias
- CAP-CLINICALINTEL-AUDIT-DEEP-001 — Clinical Intelligence — auditoría boton por boton: IA generativa simulada eliminada (R6 en pausa), determinista real
- CAP-REPORTES-AUDIT-DEEP-001 — Reportes — auditoría boton por boton: solo indicadores con dato agregado real, sin gráficas ficticias
- CAP-BIBLIOTECA-AUDIT-DEEP-001 — Biblioteca clínica — auditoría boton por boton: catálogo de referencia honesto, sin inventario ni descargas falsas
- CAP-CONFIGURACION-AUDIT-DEEP-001 — Configuración — auditoría: ajustes presentacionales honestos; sin control destructivo falso ni toggle de IA (R6)
- CAP-OFFICE-SETTINGS-BACKEND-001 — Configuración — backend real de ajustes del consultorio (singleton por tenant, event-sourced, If-Match)
- CAP-OFFICE-SETTINGS-SCHEDULE-BACKEND-001 — Configuración — horarios de atención y módulos activos reales (persistidos, controlados)
- CAP-OFFICE-SETTINGS-PREFS-BACKEND-001 — Configuración — preferencias de consulta y configuraciones regionales reales (persistidas, controladas)
- CAP-PHYSICIAN-PROFILE-SIGNATURE-BLOB-BACKEND-001 — Configuración — firma y sello del médico (imágenes) en Vercel Blob privado, por-usuario
- CAP-DOCUMENT-REPOSITORY-BACKEND-001 — Documentos — repositorio: GET de un documento con contenido real, adenda append-only y firma
- CAP-DOCUMENT-ATTACHMENTS-BLOB-BACKEND-001 — Documentos — adjuntos binarios (PHI) en Vercel Blob privado: subir, ver y quitar
- CAP-REPORTES-AGGREGATES-BACKEND-001 — Reportes — agregados reales adicionales: órdenes (total y por tipo), procedimientos, resultados, vacunas
- CAP-REPORTES-TRENDS-BACKEND-001 — Reportes — tendencia de consultas por día (encuentros) y medicamentos más prescritos (recetas reales)
- CAP-REPORTES-APPTTYPES-BACKEND-001 — Reportes — tipos de consulta desde la agenda (appointmentsByType real)
- CAP-REPORTES-QUALITY-BACKEND-001 — Reportes — indicadores de calidad deterministas (expedientes cerrados, asistencia, inasistencia, HbA1c en control)

## ❌ Evidencia faltante

- falta el libro de ejecución de pruebas unitarias (pnpm test:ledger)
- falta el libro de ejecución de pruebas en vivo (scripts/ci/live-smoke.mts)
- CAP-VERTICAL-ENCOUNTER-001: evidencia citada tests/v22/http-principal.test.ts — sin libro en el libro de ejecución
- CAP-VERTICAL-ENCOUNTER-001: prueba en vivo scripts/v22/live-encounter-endpoint-proof.mts — sin libro en el libro de ejecución
- CAP-ENCOUNTER-RUNTIME-003: evidencia citada tests/v22/encounter-fold.test.ts — sin libro en el libro de ejecución
- CAP-ENCOUNTER-RUNTIME-003: prueba en vivo scripts/v22/live-encounter-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-VERTICAL-RESULT-001: evidencia citada tests/v22/result-fold.test.ts — sin libro en el libro de ejecución
- CAP-VERTICAL-RESULT-001: prueba en vivo scripts/v22/live-result-closed-loop-proof.mts — sin libro en el libro de ejecución
- CAP-MED-AUTH-003: evidencia citada tests/v22/medication-fold.test.ts — sin libro en el libro de ejecución
- CAP-MED-AUTH-003: prueba en vivo scripts/v22/live-medication-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-AMENDMENT-001: evidencia citada tests/v22/document-fold.test.ts — sin libro en el libro de ejecución
- CAP-AMENDMENT-001: prueba en vivo scripts/v22/live-document-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-SESSION-001: evidencia citada tests/v22/session-issuance.test.ts — sin libro en el libro de ejecución
- CAP-SESSION-001: prueba en vivo scripts/v22/live-session-issuance-proof.mts — sin libro en el libro de ejecución
- CAP-IDENTITY-001: evidencia citada tests/v22/oidc-verifier.test.ts — sin libro en el libro de ejecución
- CAP-IDENTITY-001: prueba en vivo scripts/v22/live-oidc-login-proof.mts — sin libro en el libro de ejecución
- CAP-AUTHZ-001: evidencia citada tests/v22/session-issuance.test.ts — sin libro en el libro de ejecución
- CAP-AUTHZ-001: evidencia citada tests/security/authz.test.ts — sin libro en el libro de ejecución
- CAP-UUID-BOUNDARY-001: evidencia citada tests/v22/http-principal.test.ts — sin libro en el libro de ejecución
- CAP-ORDER-RESULT-001: evidencia citada tests/v22/order-fold.test.ts — sin libro en el libro de ejecución
- CAP-ORDER-RESULT-001: prueba en vivo scripts/v22/live-order-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-APP-001: evidencia citada tests/v22/session-client.test.ts — sin libro en el libro de ejecución
- CAP-OBLIGATION-002: evidencia citada tests/v22/obligation-fold.test.ts — sin libro en el libro de ejecución
- CAP-OBLIGATION-002: prueba en vivo scripts/v22/live-obligation-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-PATIENT-STATE-002: evidencia citada tests/v22/patient-summary.test.ts — sin libro en el libro de ejecución
- CAP-PROBLEM-GRAPH-001: evidencia citada tests/v22/problem-fold.test.ts — sin libro en el libro de ejecución
- CAP-PROBLEM-GRAPH-001: prueba en vivo scripts/v22/live-problem-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-ALLERGY-001: evidencia citada tests/v22/allergy-fold.test.ts — sin libro en el libro de ejecución
- CAP-ALLERGY-001: prueba en vivo scripts/v22/live-allergy-medication-gate-proof.mts — sin libro en el libro de ejecución
- CAP-PATIENT-001: evidencia citada tests/v22/patient-fold.test.ts — sin libro en el libro de ejecución
- CAP-PATIENT-001: prueba en vivo scripts/v22/live-patient-registry-proof.mts — sin libro en el libro de ejecución
- CAP-REFERRAL-001: evidencia citada tests/v22/referral-fold.test.ts — sin libro en el libro de ejecución
- CAP-REFERRAL-001: prueba en vivo scripts/v22/live-referral-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-APPOINTMENT-001: evidencia citada tests/v22/appointment-fold.test.ts — sin libro en el libro de ejecución
- CAP-APPOINTMENT-001: prueba en vivo scripts/v22/live-appointment-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-IMMUNIZATION-001: evidencia citada tests/v22/immunization-fold.test.ts — sin libro en el libro de ejecución
- CAP-IMMUNIZATION-001: prueba en vivo scripts/v22/live-immunization-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-VITAL-001: evidencia citada tests/v22/vital-fold.test.ts — sin libro en el libro de ejecución
- CAP-VITAL-001: prueba en vivo scripts/v22/live-vital-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-CAREPLAN-001: evidencia citada tests/v22/careplan-fold.test.ts — sin libro en el libro de ejecución
- CAP-CAREPLAN-001: prueba en vivo scripts/v22/live-careplan-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-CLAIM-001: evidencia citada tests/v22/claim-fold.test.ts — sin libro en el libro de ejecución
- CAP-CLAIM-001: prueba en vivo scripts/v22/live-claim-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-CONSENT-001: evidencia citada tests/v22/consent-fold.test.ts — sin libro en el libro de ejecución
- CAP-CONSENT-001: prueba en vivo scripts/v22/live-consent-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-CAREGAPS-001: evidencia citada tests/v22/care-gaps.test.ts — sin libro en el libro de ejecución
- CAP-CAREGAPS-001: prueba en vivo scripts/v22/live-care-gaps-proof.mts — sin libro en el libro de ejecución
- CAP-RECORD-EXPORT-001: evidencia citada tests/v22/record-export.test.ts — sin libro en el libro de ejecución
- CAP-RECORD-EXPORT-001: prueba en vivo scripts/v22/live-record-export-proof.mts — sin libro en el libro de ejecución
- CAP-PANEL-WORKLIST-001: evidencia citada tests/v22/care-gaps.test.ts — sin libro en el libro de ejecución
- CAP-PANEL-WORKLIST-001: prueba en vivo scripts/v22/live-panel-worklist-proof.mts — sin libro en el libro de ejecución
- CAP-ADJUDICATION-001: evidencia citada tests/v22/reconciliation-integrity.test.ts — sin libro en el libro de ejecución
- CAP-ADMISSION-001: evidencia citada tests/v22/admission-fold.test.ts — sin libro en el libro de ejecución
- CAP-ADMISSION-001: prueba en vivo scripts/v22/live-admission-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-SPECIMEN-001: evidencia citada tests/v22/specimen-fold.test.ts — sin libro en el libro de ejecución
- CAP-SPECIMEN-001: prueba en vivo scripts/v22/live-specimen-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-INCIDENT-001: evidencia citada tests/v22/incident-fold.test.ts — sin libro en el libro de ejecución
- CAP-INCIDENT-001: prueba en vivo scripts/v22/live-incident-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-TRIAGE-001: evidencia citada tests/v22/triage-fold.test.ts — sin libro en el libro de ejecución
- CAP-TRIAGE-001: prueba en vivo scripts/v22/live-triage-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-WOUND-001: evidencia citada tests/v22/wound-fold.test.ts — sin libro en el libro de ejecución
- CAP-WOUND-001: prueba en vivo scripts/v22/live-wound-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-TRANSFUSION-001: evidencia citada tests/v22/transfusion-fold.test.ts — sin libro en el libro de ejecución
- CAP-TRANSFUSION-001: prueba en vivo scripts/v22/live-transfusion-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-SURGERY-001: evidencia citada tests/v22/surgery-fold.test.ts — sin libro en el libro de ejecución
- CAP-SURGERY-001: prueba en vivo scripts/v22/live-surgery-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-DIALYSIS-001: evidencia citada tests/v22/dialysis-fold.test.ts — sin libro en el libro de ejecución
- CAP-DIALYSIS-001: prueba en vivo scripts/v22/live-dialysis-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-TERMINOLOGY-001: evidencia citada tests/v22/terminology.test.ts — sin libro en el libro de ejecución
- CAP-TERMINOLOGY-001: prueba en vivo scripts/v22/live-terminology-proof.mts — sin libro en el libro de ejecución
- CAP-VITALS-REF-001: evidencia citada tests/v22/lab-reference.test.ts — sin libro en el libro de ejecución
- CAP-VITALS-REF-001: prueba en vivo scripts/v22/live-vitals-reference-proof.mts — sin libro en el libro de ejecución
- CAP-CRITICAL-VITAL-GAP-001: evidencia citada tests/v22/care-gaps.test.ts — sin libro en el libro de ejecución
- CAP-CRITICAL-VITAL-GAP-001: prueba en vivo scripts/v22/live-critical-vital-gap-proof.mts — sin libro en el libro de ejecución
- CAP-DRUG-ALLERGY-001: evidencia citada tests/v22/drug-catalog.test.ts — sin libro en el libro de ejecución
- CAP-DRUG-ALLERGY-001: prueba en vivo scripts/v22/live-cross-reactivity-gate-proof.mts — sin libro en el libro de ejecución
- CAP-BILLING-ICD10-001: evidencia citada tests/v22/terminology.test.ts — sin libro en el libro de ejecución
- CAP-BILLING-ICD10-001: prueba en vivo scripts/v22/live-claim-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-CRITICAL-VITAL-LOOP-001: evidencia citada tests/v22/lab-reference.test.ts — sin libro en el libro de ejecución
- CAP-CRITICAL-VITAL-LOOP-001: prueba en vivo scripts/v22/live-critical-vital-signing-loop-proof.mts — sin libro en el libro de ejecución
- CAP-CLINICAL-INTEL-001: evidencia citada tests/v22/clinical-intelligence.test.ts — sin libro en el libro de ejecución
- CAP-LAB-REF-002: evidencia citada tests/v22/lab-reference.test.ts — sin libro en el libro de ejecución
- CAP-MED-VALIDATION-001: evidencia citada tests/v22/medication-validation.test.ts — sin libro en el libro de ejecución
- CAP-MED-VALIDATION-001: prueba en vivo scripts/v22/live-medication-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-DUPLICATE-THERAPY-001: evidencia citada tests/v22/drug-catalog.test.ts — sin libro en el libro de ejecución
- CAP-DUPLICATE-THERAPY-001: prueba en vivo scripts/v22/live-duplicate-therapy-gate-proof.mts — sin libro en el libro de ejecución
- CAP-DRUG-INTERACTION-001: evidencia citada tests/v22/drug-catalog.test.ts — sin libro en el libro de ejecución
- CAP-DRUG-INTERACTION-001: prueba en vivo scripts/v22/live-drug-interaction-gate-proof.mts — sin libro en el libro de ejecución
- CAP-DRUG-CONDITION-001: evidencia citada tests/v22/drug-catalog.test.ts — sin libro en el libro de ejecución
- CAP-DRUG-CONDITION-001: prueba en vivo scripts/v22/live-drug-condition-contraindication-gate-proof.mts — sin libro en el libro de ejecución
- CAP-DOSE-CEILING-001: evidencia citada tests/v22/medication-validation.test.ts — sin libro en el libro de ejecución
- CAP-DOSE-CEILING-001: prueba en vivo scripts/v22/live-dose-ceiling-gate-proof.mts — sin libro en el libro de ejecución
- CAP-MONITORING-OBLIGATION-001: evidencia citada tests/v22/drug-catalog.test.ts — sin libro en el libro de ejecución
- CAP-MONITORING-OBLIGATION-001: prueba en vivo scripts/v22/live-monitoring-obligation-proof.mts — sin libro en el libro de ejecución
- CAP-LAB-DELTA-001: evidencia citada tests/v22/lab-reference.test.ts — sin libro en el libro de ejecución
- CAP-LAB-DELTA-001: prueba en vivo scripts/v22/live-lab-delta-check-proof.mts — sin libro en el libro de ejecución
- CAP-NEWS2-001: evidencia citada tests/v22/lab-reference.test.ts — sin libro en el libro de ejecución
- CAP-NEWS2-001: prueba en vivo scripts/v22/live-news2-score-proof.mts — sin libro en el libro de ejecución
- CAP-PEDIATRIC-DOSE-001: evidencia citada tests/v22/medication-validation.test.ts — sin libro en el libro de ejecución
- CAP-PEDIATRIC-DOSE-001: prueba en vivo scripts/v22/live-pediatric-dose-gate-proof.mts — sin libro en el libro de ejecución
- CAP-LIVE-REGRESSION-001: evidencia citada scripts/ci/live-smoke.mts — sin libro en el libro de ejecución
- CAP-LIVE-REGRESSION-001: prueba en vivo scripts/ci/live-smoke.mts — sin libro en el libro de ejecución
- CAP-NOT-WIRED-REGISTRY-001: evidencia citada tests/v22/not-wired-integrity.test.ts — sin libro en el libro de ejecución
- CAP-OBSERVABILITY-SLI-001: evidencia citada tests/v22/observability-sli.test.ts — sin libro en el libro de ejecución
- CAP-OBSERVABILITY-SLI-001: prueba en vivo scripts/v22/live-observability-sli-proof.mts — sin libro en el libro de ejecución
- CAP-BACKUP-DR-001: evidencia citada tests/v22/downtime-no-false-save.test.ts — sin libro en el libro de ejecución
- CAP-BACKUP-DR-001: prueba en vivo scripts/v22/live-dr-recovery-proof.mts — sin libro en el libro de ejecución
- CAP-COMPLIANCE-NOM-001: evidencia citada tests/v22/nom-compliance-integrity.test.ts — sin libro en el libro de ejecución
- CAP-DEV-IDENTITY-HARDENING-001: evidencia citada tests/v22/dev-identity-prod-guard.test.ts — sin libro en el libro de ejecución
- CAP-IMMUNIZATION-FORECAST-001: evidencia citada tests/v22/immunization-schedule.test.ts — sin libro en el libro de ejecución
- CAP-IMMUNIZATION-FORECAST-001: prueba en vivo scripts/v22/live-immunization-forecast-proof.mts — sin libro en el libro de ejecución
- CAP-RENAL-EGFR-001: evidencia citada tests/v22/renal-function.test.ts — sin libro en el libro de ejecución
- CAP-RENAL-EGFR-001: prueba en vivo scripts/v22/live-egfr-proof.mts — sin libro en el libro de ejecución
- CAP-RENAL-DOSING-001: evidencia citada tests/v22/drug-catalog.test.ts — sin libro en el libro de ejecución
- CAP-RENAL-DOSING-001: prueba en vivo scripts/v22/live-renal-dosing-gate-proof.mts — sin libro en el libro de ejecución
- CAP-LAB-DERIVATIONS-001: evidencia citada tests/v22/lab-derivations.test.ts — sin libro en el libro de ejecución
- CAP-LAB-DERIVATIONS-001: prueba en vivo scripts/v22/live-metabolic-panel-proof.mts — sin libro en el libro de ejecución
- CAP-ANTHROPOMETRICS-BMI-001: evidencia citada tests/v22/anthropometrics.test.ts — sin libro en el libro de ejecución
- CAP-ANTHROPOMETRICS-BMI-001: prueba en vivo scripts/v22/live-bmi-proof.mts — sin libro en el libro de ejecución
- CAP-GLYCEMIC-CONTROL-001: evidencia citada tests/v22/glycemic.test.ts — sin libro en el libro de ejecución
- CAP-GLYCEMIC-CONTROL-001: prueba en vivo scripts/v22/live-glycemic-status-proof.mts — sin libro en el libro de ejecución
- CAP-STROKE-RISK-001: evidencia citada tests/v22/stroke-risk.test.ts — sin libro en el libro de ejecución
- CAP-STROKE-RISK-001: prueba en vivo scripts/v22/live-cha2ds2vasc-proof.mts — sin libro en el libro de ejecución
- CAP-LIVER-FIB4-001: evidencia citada tests/v22/liver-fibrosis.test.ts — sin libro en el libro de ejecución
- CAP-LIVER-FIB4-001: prueba en vivo scripts/v22/live-fib4-proof.mts — sin libro en el libro de ejecución
- CAP-CLINICAL-INTELLIGENCE-001: evidencia citada tests/v22/clinical-summary.test.ts — sin libro en el libro de ejecución
- CAP-CLINICAL-INTELLIGENCE-001: prueba en vivo scripts/v22/live-clinical-intelligence-proof.mts — sin libro en el libro de ejecución
- CAP-BP-STAGING-001: evidencia citada tests/v22/bp-staging.test.ts — sin libro en el libro de ejecución
- CAP-BP-STAGING-001: prueba en vivo scripts/v22/live-bp-stage-proof.mts — sin libro en el libro de ejecución
- CAP-ANTICOAG-INR-001: evidencia citada tests/v22/anticoagulation.test.ts — sin libro en el libro de ejecución
- CAP-ANTICOAG-INR-001: prueba en vivo scripts/v22/live-anticoagulation-status-proof.mts — sin libro en el libro de ejecución
- CAP-MELD-001: evidencia citada tests/v22/meld.test.ts — sin libro en el libro de ejecución
- CAP-MELD-001: prueba en vivo scripts/v22/live-meld-proof.mts — sin libro en el libro de ejecución
- CAP-ACID-BASE-001: evidencia citada tests/v22/acid-base.test.ts — sin libro en el libro de ejecución
- CAP-ACID-BASE-001: prueba en vivo scripts/v22/live-acid-base-proof.mts — sin libro en el libro de ejecución
- CAP-PNEUMONIA-CURB65-001: evidencia citada tests/v22/pneumonia-severity.test.ts — sin libro en el libro de ejecución
- CAP-PNEUMONIA-CURB65-001: prueba en vivo scripts/v22/live-curb65-proof.mts — sin libro en el libro de ejecución
- CAP-OXYGENATION-AA-001: evidencia citada tests/v22/oxygenation.test.ts — sin libro en el libro de ejecución
- CAP-OXYGENATION-AA-001: prueba en vivo scripts/v22/live-aa-gradient-proof.mts — sin libro en el libro de ejecución
- CAP-AI-COPILOT-GATEWAY-001: evidencia citada tests/v22/ai-copilot-gateway.test.ts — sin libro en el libro de ejecución
- CAP-AI-COPILOT-GATEWAY-001: prueba en vivo scripts/v22/live-ai-copilot-gateway-proof.mts — sin libro en el libro de ejecución
- CAP-AI-EVAL-HARNESS-001: evidencia citada tests/v22/ai-eval-suite.test.ts — sin libro en el libro de ejecución
- CAP-COMORBIDITY-CHARLSON-001: evidencia citada tests/v22/comorbidity.test.ts — sin libro en el libro de ejecución
- CAP-COMORBIDITY-CHARLSON-001: prueba en vivo scripts/v22/live-charlson-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTATION-SNAPSHOT-001: evidencia citada scripts/v22/live-consultation-snapshot-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTATION-SNAPSHOT-001: prueba en vivo scripts/v22/live-consultation-snapshot-proof.mts — sin libro en el libro de ejecución
- CAP-TRENDS-LONGITUDINAL-001: evidencia citada scripts/v22/live-trends-proof.mts — sin libro en el libro de ejecución
- CAP-TRENDS-LONGITUDINAL-001: prueba en vivo scripts/v22/live-trends-proof.mts — sin libro en el libro de ejecución
- CAP-PRESCRIPTION-CHECK-001: evidencia citada scripts/v22/live-prescription-check-proof.mts — sin libro en el libro de ejecución
- CAP-PRESCRIPTION-CHECK-001: prueba en vivo scripts/v22/live-prescription-check-proof.mts — sin libro en el libro de ejecución
- CAP-UI-COCKPIT-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-PATIENT-DEMOGRAPHICS-001: evidencia citada scripts/v22/live-patient-demographics-proof.mts — sin libro en el libro de ejecución
- CAP-PATIENT-DEMOGRAPHICS-001: prueba en vivo scripts/v22/live-patient-demographics-proof.mts — sin libro en el libro de ejecución
- CAP-AGENDA-DAY-001: evidencia citada scripts/v22/live-agenda-day-proof.mts — sin libro en el libro de ejecución
- CAP-AGENDA-DAY-001: prueba en vivo scripts/v22/live-agenda-day-proof.mts — sin libro en el libro de ejecución
- CAP-DRUG-INTERACTION-SET-001: evidencia citada scripts/v22/live-interactions-proof.mts — sin libro en el libro de ejecución
- CAP-DRUG-INTERACTION-SET-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-DRUG-INTERACTION-SET-001: prueba en vivo scripts/v22/live-interactions-proof.mts — sin libro en el libro de ejecución
- CAP-ALLERGY-REGISTRY-001: evidencia citada scripts/v22/live-allergy-registry-proof.mts — sin libro en el libro de ejecución
- CAP-ALLERGY-REGISTRY-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-ALLERGY-REGISTRY-001: prueba en vivo scripts/v22/live-allergy-registry-proof.mts — sin libro en el libro de ejecución
- CAP-PROBLEM-REGISTRY-001: evidencia citada scripts/v22/live-problem-registry-proof.mts — sin libro en el libro de ejecución
- CAP-PROBLEM-REGISTRY-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-PROBLEM-REGISTRY-001: prueba en vivo scripts/v22/live-problem-registry-proof.mts — sin libro en el libro de ejecución
- CAP-IMMUNIZATION-REGISTRY-001: evidencia citada scripts/v22/live-immunization-registry-proof.mts — sin libro en el libro de ejecución
- CAP-IMMUNIZATION-REGISTRY-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-IMMUNIZATION-REGISTRY-001: prueba en vivo scripts/v22/live-immunization-registry-proof.mts — sin libro en el libro de ejecución
- CAP-VITALS-HISTORY-001: evidencia citada scripts/v22/live-vitals-history-proof.mts — sin libro en el libro de ejecución
- CAP-VITALS-HISTORY-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-VITALS-HISTORY-001: prueba en vivo scripts/v22/live-vitals-history-proof.mts — sin libro en el libro de ejecución
- CAP-CARE-PLAN-SNAPSHOT-001: evidencia citada scripts/v22/live-care-plan-snapshot-proof.mts — sin libro en el libro de ejecución
- CAP-CARE-PLAN-SNAPSHOT-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CARE-PLAN-SNAPSHOT-001: prueba en vivo scripts/v22/live-care-plan-snapshot-proof.mts — sin libro en el libro de ejecución
- CAP-REFERRAL-CONTEXT-001: evidencia citada scripts/v22/live-referral-context-proof.mts — sin libro en el libro de ejecución
- CAP-REFERRAL-CONTEXT-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-REFERRAL-CONTEXT-001: prueba en vivo scripts/v22/live-referral-context-proof.mts — sin libro en el libro de ejecución
- CAP-FOLLOW-UP-SNAPSHOT-001: evidencia citada scripts/v22/live-follow-up-snapshot-proof.mts — sin libro en el libro de ejecución
- CAP-FOLLOW-UP-SNAPSHOT-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-FOLLOW-UP-SNAPSHOT-001: prueba en vivo scripts/v22/live-follow-up-snapshot-proof.mts — sin libro en el libro de ejecución
- CAP-CLAIMS-REGISTRY-001: evidencia citada scripts/v22/live-claims-registry-proof.mts — sin libro en el libro de ejecución
- CAP-CLAIMS-REGISTRY-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CLAIMS-REGISTRY-001: prueba en vivo scripts/v22/live-claims-registry-proof.mts — sin libro en el libro de ejecución
- CAP-DOCUMENTS-REGISTRY-001: evidencia citada scripts/v22/live-documents-proof.mts — sin libro en el libro de ejecución
- CAP-DOCUMENTS-REGISTRY-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-DOCUMENTS-REGISTRY-001: prueba en vivo scripts/v22/live-documents-proof.mts — sin libro en el libro de ejecución
- CAP-REGULATORY-OBLIGATIONS-001: evidencia citada scripts/v22/live-regulatory-obligations-proof.mts — sin libro en el libro de ejecución
- CAP-REGULATORY-OBLIGATIONS-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-REGULATORY-OBLIGATIONS-001: prueba en vivo scripts/v22/live-regulatory-obligations-proof.mts — sin libro en el libro de ejecución
- CAP-CLINICAL-INTELLIGENCE-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-REPORTS-DASHBOARD-001: evidencia citada scripts/v22/live-reports-proof.mts — sin libro en el libro de ejecución
- CAP-REPORTS-DASHBOARD-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-REPORTS-DASHBOARD-001: prueba en vivo scripts/v22/live-reports-proof.mts — sin libro en el libro de ejecución
- CAP-CLINICAL-LIBRARY-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-SETTINGS-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-RESULTS-REGISTRY-001: evidencia citada scripts/v22/live-results-registry-proof.mts — sin libro en el libro de ejecución
- CAP-RESULTS-REGISTRY-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-RESULTS-REGISTRY-001: prueba en vivo scripts/v22/live-results-registry-proof.mts — sin libro en el libro de ejecución
- CAP-RESULTS-TABS-001: evidencia citada scripts/v22/live-orders-registry-proof.mts — sin libro en el libro de ejecución
- CAP-RESULTS-TABS-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-RESULTS-TABS-001: prueba en vivo scripts/v22/live-orders-registry-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTATION-TABS-001: evidencia citada scripts/v22/live-consultation-tabs-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTATION-TABS-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CONSULTATION-TABS-001: prueba en vivo scripts/v22/live-consultation-tabs-proof.mts — sin libro en el libro de ejecución
- CAP-ORDERS-LIFECYCLE-UI-001: evidencia citada scripts/v22/live-orders-registry-proof.mts — sin libro en el libro de ejecución
- CAP-ORDERS-LIFECYCLE-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-ORDERS-LIFECYCLE-UI-001: prueba en vivo scripts/v22/live-orders-registry-proof.mts — sin libro en el libro de ejecución
- CAP-MEDICATIONS-CATALOG-UI-001: evidencia citada tests/v22/drug-catalog.test.ts — sin libro en el libro de ejecución
- CAP-MEDICATIONS-CATALOG-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-AGENDA-LIFECYCLE-UI-001: evidencia citada scripts/v22/live-agenda-day-proof.mts — sin libro en el libro de ejecución
- CAP-AGENDA-LIFECYCLE-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-AGENDA-LIFECYCLE-UI-001: prueba en vivo scripts/v22/live-agenda-day-proof.mts — sin libro en el libro de ejecución
- CAP-PATIENTS-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-PATIENTS-UI-001: evidencia citada scripts/v22/live-patient-registry-proof.mts — sin libro en el libro de ejecución
- CAP-PATIENTS-UI-001: evidencia citada scripts/v22/live-patient-demographics-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTA-ENCOUNTER-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CONSULTA-ENCOUNTER-UI-001: evidencia citada scripts/v22/live-encounter-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTA-ENCOUNTER-UI-001: evidencia citada scripts/v22/live-result-closed-loop-proof.mts — sin libro en el libro de ejecución
- CAP-INICIO-DASHBOARD-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-INICIO-DASHBOARD-UI-001: evidencia citada scripts/v22/live-patient-registry-proof.mts — sin libro en el libro de ejecución
- CAP-INICIO-DASHBOARD-UI-001: evidencia citada scripts/v22/live-agenda-day-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTA-VITALS-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CONSULTA-VITALS-UI-001: evidencia citada scripts/v22/live-critical-vital-signing-loop-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTA-VITALS-UI-001: evidencia citada scripts/v22/live-vitals-history-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTA-ORDERS-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CONSULTA-ORDERS-UI-001: evidencia citada scripts/v22/live-orders-registry-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTA-PROBLEMS-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CONSULTA-PROBLEMS-UI-001: evidencia citada scripts/v22/live-problem-registry-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTA-ANTECEDENTES-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CONSULTA-ANTECEDENTES-UI-001: evidencia citada scripts/v22/live-encounter-lifecycle-proof.mts — sin libro en el libro de ejecución
- CAP-ALLERGIES-CREATE-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-ALLERGIES-CREATE-UI-001: evidencia citada scripts/v22/live-allergy-registry-proof.mts — sin libro en el libro de ejecución
- CAP-ALLERGIES-CREATE-UI-001: evidencia citada scripts/v22/live-allergy-medication-gate-proof.mts — sin libro en el libro de ejecución
- CAP-IMMUNIZATIONS-CREATE-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-IMMUNIZATIONS-CREATE-UI-001: evidencia citada scripts/v22/live-immunization-registry-proof.mts — sin libro en el libro de ejecución
- CAP-IMMUNIZATIONS-CREATE-UI-001: evidencia citada scripts/v22/live-immunization-forecast-proof.mts — sin libro en el libro de ejecución
- CAP-CAREPLAN-CREATE-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CAREPLAN-CREATE-UI-001: evidencia citada scripts/v22/live-care-plan-snapshot-proof.mts — sin libro en el libro de ejecución
- CAP-DOCUMENTS-CREATE-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-DOCUMENTS-CREATE-UI-001: evidencia citada scripts/v22/live-documents-proof.mts — sin libro en el libro de ejecución
- CAP-REGULATORY-OBLIGATIONS-CREATE-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-REGULATORY-OBLIGATIONS-CREATE-UI-001: evidencia citada scripts/v22/live-regulatory-obligations-proof.mts — sin libro en el libro de ejecución
- CAP-BILLING-PATIENT-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-BILLING-PATIENT-UI-001: evidencia citada scripts/v22/live-claims-registry-proof.mts — sin libro en el libro de ejecución
- CAP-REFERRALS-PATIENT-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-REFERRALS-PATIENT-UI-001: evidencia citada scripts/v22/live-referral-context-proof.mts — sin libro en el libro de ejecución
- CAP-RESULTS-CREATE-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-RESULTS-CREATE-UI-001: evidencia citada scripts/v22/live-results-registry-proof.mts — sin libro en el libro de ejecución
- CAP-RESULTS-CREATE-UI-001: evidencia citada scripts/v22/live-result-closed-loop-proof.mts — sin libro en el libro de ejecución
- CAP-VITALS-MODULE-PATIENT-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-VITALS-MODULE-PATIENT-UI-001: evidencia citada scripts/v22/live-vitals-history-proof.mts — sin libro en el libro de ejecución
- CAP-VITALS-MODULE-PATIENT-UI-001: evidencia citada scripts/v22/live-critical-vital-signing-loop-proof.mts — sin libro en el libro de ejecución
- CAP-PATIENTS-FICHA-EDIT-UI-001: evidencia citada scripts/v22/live-patient-amend-proof.mts — sin libro en el libro de ejecución
- CAP-PATIENTS-FICHA-EDIT-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-PATIENTS-FICHA-EDIT-UI-001: prueba en vivo scripts/v22/live-patient-amend-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTA-PANEL-UI-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CONSULTA-PANEL-UI-001: evidencia citada scripts/v22/live-agenda-day-proof.mts — sin libro en el libro de ejecución
- CAP-CONSULTA-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-AGENDA-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-AGENDA-AUDIT-DEEP-001: evidencia citada scripts/v22/live-agenda-day-proof.mts — sin libro en el libro de ejecución
- CAP-RESULTADOS-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-RESULTADOS-AUDIT-DEEP-001: evidencia citada scripts/v22/live-results-registry-proof.mts — sin libro en el libro de ejecución
- CAP-MEDICAMENTOS-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-ORDENES-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-ORDENES-AUDIT-DEEP-001: evidencia citada scripts/v22/live-orders-registry-proof.mts — sin libro en el libro de ejecución
- CAP-ALERGIAS-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-ALERGIAS-AUDIT-DEEP-001: evidencia citada scripts/v22/live-allergy-registry-proof.mts — sin libro en el libro de ejecución
- CAP-PROBLEMAS-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-PROBLEMAS-AUDIT-DEEP-001: evidencia citada scripts/v22/live-problem-registry-proof.mts — sin libro en el libro de ejecución
- CAP-VACUNAS-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-VACUNAS-AUDIT-DEEP-001: evidencia citada scripts/v22/live-immunization-registry-proof.mts — sin libro en el libro de ejecución
- CAP-SIGNOS-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-SIGNOS-AUDIT-DEEP-001: evidencia citada scripts/v22/live-vitals-history-proof.mts — sin libro en el libro de ejecución
- CAP-PLANCUIDADO-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-PLANCUIDADO-AUDIT-DEEP-001: evidencia citada scripts/v22/live-care-plan-snapshot-proof.mts — sin libro en el libro de ejecución
- CAP-INTERCONSULTA-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-INTERCONSULTA-AUDIT-DEEP-001: evidencia citada scripts/v22/live-referral-context-proof.mts — sin libro en el libro de ejecución
- CAP-SEGUIMIENTO-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-SEGUIMIENTO-AUDIT-DEEP-001: evidencia citada scripts/v22/live-follow-up-snapshot-proof.mts — sin libro en el libro de ejecución
- CAP-FACTURACION-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-FACTURACION-AUDIT-DEEP-001: evidencia citada scripts/v22/live-claims-registry-proof.mts — sin libro en el libro de ejecución
- CAP-DOCUMENTOS-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-DOCUMENTOS-AUDIT-DEEP-001: evidencia citada scripts/v22/live-documents-proof.mts — sin libro en el libro de ejecución
- CAP-OBLIGACIONES-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-OBLIGACIONES-AUDIT-DEEP-001: evidencia citada scripts/v22/live-regulatory-obligations-proof.mts — sin libro en el libro de ejecución
- CAP-CLINICALINTEL-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CLINICALINTEL-AUDIT-DEEP-001: evidencia citada scripts/v22/live-clinical-intelligence-proof.mts — sin libro en el libro de ejecución
- CAP-REPORTES-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-REPORTES-AUDIT-DEEP-001: evidencia citada scripts/v22/live-reports-proof.mts — sin libro en el libro de ejecución
- CAP-BIBLIOTECA-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-CONFIGURACION-AUDIT-DEEP-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-OFFICE-SETTINGS-BACKEND-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-OFFICE-SETTINGS-BACKEND-001: evidencia citada scripts/v22/live-office-settings-proof.mts — sin libro en el libro de ejecución
- CAP-OFFICE-SETTINGS-SCHEDULE-BACKEND-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-OFFICE-SETTINGS-SCHEDULE-BACKEND-001: evidencia citada scripts/v22/live-office-settings-proof.mts — sin libro en el libro de ejecución
- CAP-OFFICE-SETTINGS-PREFS-BACKEND-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-OFFICE-SETTINGS-PREFS-BACKEND-001: evidencia citada scripts/v22/live-office-settings-proof.mts — sin libro en el libro de ejecución
- CAP-PHYSICIAN-PROFILE-SIGNATURE-BLOB-BACKEND-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-PHYSICIAN-PROFILE-SIGNATURE-BLOB-BACKEND-001: evidencia citada scripts/v22/live-physician-profile-proof.mts — sin libro en el libro de ejecución
- CAP-DOCUMENT-REPOSITORY-BACKEND-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-DOCUMENT-REPOSITORY-BACKEND-001: evidencia citada scripts/v22/live-document-detail-proof.mts — sin libro en el libro de ejecución
- CAP-DOCUMENT-ATTACHMENTS-BLOB-BACKEND-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-DOCUMENT-ATTACHMENTS-BLOB-BACKEND-001: evidencia citada scripts/v22/live-document-attachment-proof.mts — sin libro en el libro de ejecución
- CAP-REPORTES-AGGREGATES-BACKEND-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-REPORTES-AGGREGATES-BACKEND-001: evidencia citada scripts/v22/live-reports-proof.mts — sin libro en el libro de ejecución
- CAP-REPORTES-TRENDS-BACKEND-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-REPORTES-TRENDS-BACKEND-001: evidencia citada scripts/v22/live-reports-proof.mts — sin libro en el libro de ejecución
- CAP-REPORTES-APPTTYPES-BACKEND-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-REPORTES-APPTTYPES-BACKEND-001: evidencia citada scripts/v22/live-reports-proof.mts — sin libro en el libro de ejecución
- CAP-REPORTES-QUALITY-BACKEND-001: evidencia citada tests/v22/ui-cockpit-render.test.tsx — sin libro en el libro de ejecución
- CAP-REPORTES-QUALITY-BACKEND-001: evidencia citada scripts/v22/live-reports-proof.mts — sin libro en el libro de ejecución

## Riesgo C3

### CAP-CLINICAL-LIBRARY-UI-001 — Biblioteca Clínica — repositorio de conocimiento (referencia) con herramientas reales enlazadas
- Epic: REF/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Biblioteca Clínica: KPIs, especialidades, contenido destacado, herramientas, fuentes)` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-SETTINGS-UI-001 — Configuración — ajustes/preferencias del consultorio (presentacional)
- Epic: CFG/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Configuración: secciones, módulos, guardar -> confirmación)` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-OFFICE-SETTINGS-PREFS-BACKEND-001 — Configuración — preferencias de consulta y configuraciones regionales reales (persistidas, controladas)
- Epic: S-CONFIG/BACKEND
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Configuracion: Configuraciones regionales presente, input Estado/Provincia controlado y editable)` — SIN LIBRO; `scripts/v22/live-office-settings-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

## Riesgo C4

### CAP-AUTHZ-001 — Tenant/Role/Scope/Purpose Authorization
- Epic: RBAC
- Invariantes: 3
- Tests: `tests/v22/session-issuance.test.ts (scopesForRoles + union)` — SIN LIBRO; `tests/security/authz.test.ts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-APP-001 — Clinical Application Service Layer
- Epic: K (UI)
- Invariantes: 1
- Tests: `tests/v22/session-client.test.ts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ADJUDICATION-001 — Validador de evidencia de adjudicación + dossier de aceptación C5 (turnkey)
- Epic: AD
- Invariantes: 4
- Tests: `tests/v22/reconciliation-integrity.test.ts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CLINICAL-INTELLIGENCE-UI-001 — Clinical Intelligence — alertas y calculadoras deterministas (IA generativa R6 en pausa)
- Epic: R6/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Clinical Intelligence: asistente, alertas, diferencial, calculadoras, nota de gobernanza)` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PATIENTS-UI-001 — Pacientes — búsqueda/filtros reales + creador inline + interconexión (Agenda/expediente)
- Epic: IDENT/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Pacientes: lista/busqueda/filtro/creador/interconexion)` — SIN LIBRO; `scripts/v22/live-patient-registry-proof.mts` — SIN LIBRO; `scripts/v22/live-patient-demographics-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-INICIO-DASHBOARD-UI-001 — Inicio — dashboard interconectado por contexto de paciente + KPIs de la agenda real
- Epic: UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Inicio: KPIs de agenda + tarea que abre la Consulta del paciente)` — SIN LIBRO; `scripts/v22/live-patient-registry-proof.mts` — SIN LIBRO; `scripts/v22/live-agenda-day-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONSULTA-ANTECEDENTES-UI-001 — Consulta — antecedentes marcados se componen en la nota del encuentro (persisten al firmar)
- Epic: D/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Consulta: antecedente marcado -> aparece en la nota compuesta)` — SIN LIBRO; `scripts/v22/live-encounter-lifecycle-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CAREPLAN-CREATE-UI-001 — Plan de cuidado — agregar metas reales al plan del paciente (POST /care-plans)
- Epic: BC/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Plan de cuidado: agregar meta -> POST /care-plans)` — SIN LIBRO; `scripts/v22/live-care-plan-snapshot-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REGULATORY-OBLIGATIONS-CREATE-UI-001 — Obligaciones — alta inline real de obligaciones regulatorias del consultorio (POST /regulatory-obligations)
- Epic: AC/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Obligaciones: agregar obligacion -> POST /regulatory-obligations)` — SIN LIBRO; `scripts/v22/live-regulatory-obligations-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONSULTA-PANEL-UI-001 — Consulta — panel de consultas del día; el workspace se abre al elegir paciente/cita
- Epic: D/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Consulta: es un panel; abrir cita -> workspace; helper abrirConsulta en el resto)` — SIN LIBRO; `scripts/v22/live-agenda-day-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONSULTA-AUDIT-DEEP-001 — Consulta — auditoría boton por boton: cero controles muertos/cosméticos en el workspace
- Epic: D/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Consulta: interrogatorio/exploracion alimentan la nota; ausencia de + Añadir muerto)` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-AGENDA-AUDIT-DEEP-001 — Agenda — auditoría boton por boton: rejilla y contadores 100% reales (sin citas de ejemplo)
- Epic: D/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Agenda: citas reales cableadas + queryByText de nombres de ejemplo === null)` — SIN LIBRO; `scripts/v22/live-agenda-day-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-RESULTADOS-AUDIT-DEEP-001 — Resultados — auditoría boton por boton: navegador real (filtros/lista/detalle) sin maqueta ni datos falsos
- Epic: S7/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Resultados S7: detalle real Clasificacion CDS + Ciclo de vida; Descargar PDF y Folio falso === null; filtro de busqueda filtra la lista)` — SIN LIBRO; `scripts/v22/live-results-registry-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-MEDICAMENTOS-AUDIT-DEEP-001 — Medicamentos — auditoría boton por boton: catálogo/interacciones/alertas 100% reales (confirmado)
- Epic: S8/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Medicamentos › Interacciones S8.3: verificador de conjunto cableado — chips, factores, hallazgos con severidad)` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ORDENES-AUDIT-DEEP-001 — Órdenes — auditoría boton por boton: KPIs y distribución 100% reales (sin fallback ficticio)
- Epic: S8/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Ordenes: KPIs reales, lista, detalle, transiciones, creador; Ordenes por tipo real y sin estado vacio con datos)` — SIN LIBRO; `scripts/v22/live-orders-registry-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ALERGIAS-AUDIT-DEEP-001 — Alergias — auditoría boton por boton: registro real, cero controles muertos, fix de navegación
- Epic: S-ALERGIAS/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Alergias S-ALERGIAS: registro real, Ver en el expediente presente; Exportar/Accesos rapidos/Registro rapido === null)` — SIN LIBRO; `scripts/v22/live-allergy-registry-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PROBLEMAS-AUDIT-DEEP-001 — Problemas — auditoría boton por boton (pantalla lista): registro real, cero controles muertos, fix de navegación
- Epic: S-PROBLEMAS/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Problemas S-PROBLEMAS: registro real, Ver en el expediente presente; Exportar/Accesos rapidos === null; navegacion a Nuevo y Plantillas)` — SIN LIBRO; `scripts/v22/live-problem-registry-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-VACUNAS-AUDIT-DEEP-001 — Vacunas — auditoría boton por boton: registro real, cero controles muertos, fix de navegación
- Epic: S-VACUNAS/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Vacunas S-VACUNAS: registro real, Dosis por vacuna/Estado de vacunacion/Dosis pendientes reales, Ver en el expediente; Acciones rapidas/Exportar/Esquemas por edad === null)` — SIN LIBRO; `scripts/v22/live-immunization-registry-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-SIGNOS-AUDIT-DEEP-001 — Signos vitales — auditoría boton por boton: historial/tendencias reales, form solo con campos persistidos
- Epic: S-SIGNOS/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Signos S-SIGNOS: sin fila ficticia 120/80; nota de hora actual; Acciones rapidas/Plantilla rapida/Estado general === null)` — SIN LIBRO; `scripts/v22/live-vitals-history-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PLANCUIDADO-AUDIT-DEEP-001 — Plan de cuidado — auditoría boton por boton: solo el espinazo real del snapshot, sin maqueta
- Epic: S-PLANCUIDADO/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Plan de cuidado S-PLANCUIDADO: 3 tarjetas reales + Nueva meta; Intervenciones/Cronograma/Educacion/Documentos/Imprimir plan === null)` — SIN LIBRO; `scripts/v22/live-care-plan-snapshot-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-INTERCONSULTA-AUDIT-DEEP-001 — Interconsultas — auditoría boton por boton: contexto real, resumen persistido, sin maqueta
- Epic: S-INTERCONSULTA/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Interconsultas S-INTERCONSULTA: form + contexto + envio; Antecedentes relevantes/Estudios anexos/Vista previa === null)` — SIN LIBRO; `scripts/v22/live-referral-context-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-SEGUIMIENTO-AUDIT-DEEP-001 — Seguimiento — auditoría boton por boton: solo el espinazo real del snapshot, sin maqueta
- Epic: S-SEGUIMIENTO/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Seguimiento S-SEGUIMIENTO: Tendencia/Indicadores/Tareas reales; Historia de seguimiento/Control de DM2/Proxima cita/Notas/Registro rapido === null)` — SIN LIBRO; `scripts/v22/live-follow-up-snapshot-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-FACTURACION-AUDIT-DEEP-001 — Facturación — auditoría boton por boton: registro real, creador honesto, sin gráficas ni fiscales ficticios
- Epic: S-FACTURACION/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Facturación S-FACTURACION: registro real + creador; Registrar cargo emite POST /claims; Metodos de pago/Top servicios/Ingresos mensuales/Configuracion fiscal/Datos fiscales === null)` — SIN LIBRO; `scripts/v22/live-claims-registry-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DOCUMENTOS-AUDIT-DEEP-001 — Documentos — auditoría boton por boton: registro real, carpetas que filtran, sin PDF inventado
- Epic: S-DOCUMENTOS/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Documentos S-DOCUMENTOS: carpetas/chips/detalle reales + Generar desde plantilla; LABORATORIOS DEL NORTE/Carga masiva/Subido por === null)` — SIN LIBRO; `scripts/v22/live-documents-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-OBLIGACIONES-AUDIT-DEEP-001 — Obligaciones — auditoría boton por boton: registro real, tabs que filtran, sin secciones ficticias
- Epic: S-OBLIGACIONES/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Obligaciones S-OBLIGACIONES: KPI/tabla/Cumplimiento reales; Calendario/Recordatorios/Tareas pendientes/Documentos relacionados/Exportar reporte === null)` — SIN LIBRO; `scripts/v22/live-regulatory-obligations-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REPORTES-AUDIT-DEEP-001 — Reportes — auditoría boton por boton: solo indicadores con dato agregado real, sin gráficas ficticias
- Epic: S-REPORTES/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Reportes S-REPORTES: KPIs reales + Diagnosticos principales; Consultas por dia/Medicamentos mas prescritos/Indicadores de calidad/Reportes rapidos/vs. mes anterior/Exportar PDF === null)` — SIN LIBRO; `scripts/v22/live-reports-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-BIBLIOTECA-AUDIT-DEEP-001 — Biblioteca clínica — auditoría boton por boton: catálogo de referencia honesto, sin inventario ni descargas falsas
- Epic: S-BIBLIOTECA/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Biblioteca S-BIBLIOTECA: banner presentacional + Verificador de interacciones; Subir documento/Actualizar contenido/buscador/Explorar biblioteca === null)` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-OFFICE-SETTINGS-BACKEND-001 — Configuración — backend real de ajustes del consultorio (singleton por tenant, event-sourced, If-Match)
- Epic: S-CONFIG/BACKEND
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Configuracion S-CONFIG: carga de /office-settings, editar y Guardar -> Cambios guardados)` — SIN LIBRO; `scripts/v22/live-office-settings-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-OFFICE-SETTINGS-SCHEDULE-BACKEND-001 — Configuración — horarios de atención y módulos activos reales (persistidos, controlados)
- Epic: S-CONFIG/BACKEND
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Configuracion: Horarios de atencion presente, input Apertura Lunes editable, toggle role=switch de modulo Facturacion funcional)` — SIN LIBRO; `scripts/v22/live-office-settings-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DOCUMENT-REPOSITORY-BACKEND-001 — Documentos — repositorio: GET de un documento con contenido real, adenda append-only y firma
- Epic: S-DOCUMENTOS/BACKEND
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Documentos: mock del GET :id -> el detalle muestra contenido/estado)` — SIN LIBRO; `scripts/v22/live-document-detail-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REPORTES-AGGREGATES-BACKEND-001 — Reportes — agregados reales adicionales: órdenes (total y por tipo), procedimientos, resultados, vacunas
- Epic: S-REPORTES/BACKEND
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Reportes: KPIs de ordenes/vacunas, Ordenes por tipo y Procedimientos mas realizados presentes)` — SIN LIBRO; `scripts/v22/live-reports-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REPORTES-TRENDS-BACKEND-001 — Reportes — tendencia de consultas por día (encuentros) y medicamentos más prescritos (recetas reales)
- Epic: S-REPORTES/BACKEND
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Reportes: Consultas por día, Medicamentos más prescritos y fármaco real presentes)` — SIN LIBRO; `scripts/v22/live-reports-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REPORTES-APPTTYPES-BACKEND-001 — Reportes — tipos de consulta desde la agenda (appointmentsByType real)
- Epic: S-REPORTES/BACKEND
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Reportes: Tipos de consulta y etiqueta real presentes)` — SIN LIBRO; `scripts/v22/live-reports-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REPORTES-QUALITY-BACKEND-001 — Reportes — indicadores de calidad deterministas (expedientes cerrados, asistencia, inasistencia, HbA1c en control)
- Epic: S-REPORTES/BACKEND
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Reportes: Indicadores de calidad, indicador computado y 'sin datos' presentes)` — SIN LIBRO; `scripts/v22/live-reports-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

## Riesgo C5

### CAP-VERTICAL-ENCOUNTER-001 — Authenticated Encounter Vertical Slice
- Epic: B
- Invariantes: 3
- Tests: `tests/v22/http-principal.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-encounter-endpoint-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ENCOUNTER-RUNTIME-003 — Executable Encounter Assess/Sign Runtime
- Epic: D + UI
- Invariantes: 4
- Tests: `tests/v22/encounter-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-encounter-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-VERTICAL-RESULT-001 — Result-to-Obligation Closed Loop
- Epic: G
- Invariantes: 3
- Tests: `tests/v22/result-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-result-closed-loop-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-MED-AUTH-003 — Medication Prescribing Authority Boundary
- Epic: H + UI
- Invariantes: 3
- Tests: `tests/v22/medication-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-medication-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-AMENDMENT-001 — Immutable Signed-Record Amendment Ledger
- Epic: I
- Invariantes: 4
- Tests: `tests/v22/document-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-document-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-SESSION-001 — Signed Session & Principal Integrity
- Epic: E
- Invariantes: 3
- Tests: `tests/v22/session-issuance.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-session-issuance-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-IDENTITY-001 — Identity, Tenant & Clinical Access Boundary
- Epic: F
- Invariantes: 3
- Tests: `tests/v22/oidc-verifier.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-oidc-login-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-UUID-BOUNDARY-001 — Strict UUID Persistence Boundary
- Epic: actorId-fix
- Invariantes: 1
- Tests: `tests/v22/http-principal.test.ts (subjectToActorId)` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ORDER-RESULT-001 — Order & Result Closed Loop (order lifecycle)
- Epic: M
- Invariantes: 4
- Tests: `tests/v22/order-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-order-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-OBLIGATION-002 — Clinical Obligation Domain (follow-up)
- Epic: O
- Invariantes: 3
- Tests: `tests/v22/obligation-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-obligation-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PATIENT-STATE-002 — Computed Patient State Composer (resumen del paciente)
- Epic: P
- Invariantes: 2
- Tests: `tests/v22/patient-summary.test.ts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PROBLEM-GRAPH-001 — Problem list (Problem/Hypothesis/Evidence Graph surface)
- Epic: Q
- Invariantes: 3
- Tests: `tests/v22/problem-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-problem-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ALLERGY-001 — Allergy list + medication safety gate (NUEVA, no en catalogo)
- Epic: R
- Invariantes: 3
- Tests: `tests/v22/allergy-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-allergy-medication-gate-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PATIENT-001 — Registro longitudinal de pacientes (agregado Patient, identidad clinica)
- Epic: S
- Invariantes: 4
- Tests: `tests/v22/patient-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-patient-registry-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REFERRAL-001 — Interconsultas/referencias a especialista (agregado Referral)
- Epic: T
- Invariantes: 4
- Tests: `tests/v22/referral-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-referral-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-APPOINTMENT-001 — Agenda/citas (agregado Appointment, scheduling)
- Epic: U
- Invariantes: 4
- Tests: `tests/v22/appointment-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-appointment-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-IMMUNIZATION-001 — Vacunas/inmunizaciones (agregado Immunization, cartilla longitudinal)
- Epic: V
- Invariantes: 4
- Tests: `tests/v22/immunization-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-immunization-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-VITAL-001 — Signos vitales/observaciones (agregado VitalSign, append-only con corrección)
- Epic: W
- Invariantes: 4
- Tests: `tests/v22/vital-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-vital-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CAREPLAN-001 — Plan de cuidados/metas de crónicos (agregado CarePlan, care gaps longitudinales)
- Epic: X
- Invariantes: 4
- Tests: `tests/v22/careplan-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-careplan-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CLAIM-001 — Facturación/reclamaciones (agregado Claim, ciclo de ingresos)
- Epic: Y
- Invariantes: 4
- Tests: `tests/v22/claim-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-claim-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONSENT-001 — Consentimiento informado (agregado Consent, registro clínico-legal)
- Epic: Z
- Invariantes: 4
- Tests: `tests/v22/consent-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-consent-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CAREGAPS-001 — Motor de care gaps / worklist clínico (inteligencia por reglas, cross-vertical)
- Epic: AA
- Invariantes: 4
- Tests: `tests/v22/care-gaps.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-care-gaps-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-RECORD-EXPORT-001 — Export/manifiesto del expediente con hash reproducible (interoperabilidad NOM-024)
- Epic: AB
- Invariantes: 4
- Tests: `tests/v22/record-export.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-record-export-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PANEL-WORKLIST-001 — Worklist poblacional / panel del clínico (population health, cross-patient)
- Epic: AC
- Invariantes: 4
- Tests: `tests/v22/care-gaps.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-panel-worklist-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ADMISSION-001 — Internamiento/hospitalización (agregado Admission, episodio de cuidado / censo)
- Epic: AE
- Invariantes: 4
- Tests: `tests/v22/admission-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-admission-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-SPECIMEN-001 — Trazabilidad de muestras / cadena de custodia de laboratorio (fase pre-analítica)
- Epic: AF
- Invariantes: 4
- Tests: `tests/v22/specimen-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-specimen-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-INCIDENT-001 — Incidentes de seguridad del paciente / farmacovigilancia (agregado Incident)
- Epic: AG
- Invariantes: 4
- Tests: `tests/v22/incident-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-incident-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-TRIAGE-001 — Triage / clasificación de acuidad (agregado Triage, front-of-house urgencias)
- Epic: AH
- Invariantes: 5
- Tests: `tests/v22/triage-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-triage-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-WOUND-001 — Cuidado de heridas / lesiones por presión (agregado Wound, valoración longitudinal)
- Epic: AI
- Invariantes: 4
- Tests: `tests/v22/wound-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-wound-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-TRANSFUSION-001 — Transfusión sanguínea (agregado Transfusion, medicina transfusional / hemovigilancia)
- Epic: AJ
- Invariantes: 5
- Tests: `tests/v22/transfusion-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-transfusion-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-SURGERY-001 — Caso quirúrgico / quirófano (agregado Surgery, cirugía segura con time-out OMS)
- Epic: AK
- Invariantes: 4
- Tests: `tests/v22/surgery-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-surgery-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DIALYSIS-001 — Sesión de diálisis (agregado Dialysis, terapia de reemplazo renal crónica)
- Epic: AL
- Invariantes: 4
- Tests: `tests/v22/dialysis-fold.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-dialysis-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-TERMINOLOGY-001 — Terminología clínica CIE-10 + validación/codificación (PROFUNDIDAD del eje C)
- Epic: AM
- Invariantes: 4
- Tests: `tests/v22/terminology.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-terminology-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-VITALS-REF-001 — Interpretación de signos vitales por rangos de referencia (PROFUNDIDAD / CDS básico)
- Epic: AN
- Invariantes: 4
- Tests: `tests/v22/lab-reference.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-vitals-reference-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CRITICAL-VITAL-GAP-001 — Signo vital crítico como pendiente accionable (integración CDS ↔ care gaps / panel)
- Epic: AO
- Invariantes: 4
- Tests: `tests/v22/care-gaps.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-critical-vital-gap-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DRUG-ALLERGY-001 — Gate de alergias por clase + reactividad cruzada (catálogo de fármacos)
- Epic: AP
- Invariantes: 4
- Tests: `tests/v22/drug-catalog.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-cross-reactivity-gate-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-BILLING-ICD10-001 — Codificación CIE-10 validada en facturación (reclamaciones)
- Epic: AR
- Invariantes: 4
- Tests: `tests/v22/terminology.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-claim-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CRITICAL-VITAL-LOOP-001 — Lazo Zero-Lost-Follow-Up de signos vitales críticos (bloqueo de firma + resolución)
- Epic: AS
- Invariantes: 4
- Tests: `tests/v22/lab-reference.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-critical-vital-signing-loop-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CLINICAL-INTEL-001 — Motor de inteligencia clínica determinista por reglas (knowledge packages)
- Epic: AT
- Invariantes: 4
- Tests: `tests/v22/clinical-intelligence.test.ts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: REVIEW_REQUIRED_NOT_WIRED

### CAP-LAB-REF-002 — Catálogo de valores de pánico de laboratorio ampliado (28 analitos)
- Epic: AU
- Invariantes: 3
- Tests: `tests/v22/lab-reference.test.ts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-MED-VALIDATION-001 — Validación estructurada de dosis/vía/frecuencia en medicación
- Epic: AV
- Invariantes: 4
- Tests: `tests/v22/medication-validation.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-medication-lifecycle-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DUPLICATE-THERAPY-001 — Gate de duplicación terapéutica (misma clase) en la prescripción
- Epic: AW
- Invariantes: 4
- Tests: `tests/v22/drug-catalog.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-duplicate-therapy-gate-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DRUG-INTERACTION-001 — Gate de interacciones farmacológicas (DDI) en la prescripción
- Epic: AX
- Invariantes: 4
- Tests: `tests/v22/drug-catalog.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-drug-interaction-gate-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DRUG-CONDITION-001 — Gate de contraindicación fármaco–condición (drug–disease) en la prescripción
- Epic: AY
- Invariantes: 5
- Tests: `tests/v22/drug-catalog.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-drug-condition-contraindication-gate-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DOSE-CEILING-001 — Validación de dosis máxima diaria (dose ceiling) en el propose
- Epic: AZ
- Invariantes: 4
- Tests: `tests/v22/medication-validation.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-dose-ceiling-gate-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-MONITORING-OBLIGATION-001 — Obligaciones de monitoreo automáticas al prescribir (Zero-Lost-Follow-Up)
- Epic: BA
- Invariantes: 5
- Tests: `tests/v22/drug-catalog.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-monitoring-obligation-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-LAB-DELTA-001 — Delta check longitudinal de laboratorio (variación crítica entre resultados)
- Epic: BB
- Invariantes: 5
- Tests: `tests/v22/lab-reference.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-lab-delta-check-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-NEWS2-001 — NEWS2 — early warning score agregado desde signos vitales
- Epic: BC
- Invariantes: 5
- Tests: `tests/v22/lab-reference.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-news2-score-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PEDIATRIC-DOSE-001 — Ceiling de dosis pediátrica por peso (mg/kg/día) en el propose
- Epic: BD
- Invariantes: 5
- Tests: `tests/v22/medication-validation.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-pediatric-dose-gate-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-LIVE-REGRESSION-001 — Gate de regresión en vivo en CI (pruebas .mts contra Postgres desechable)
- Epic: BE
- Invariantes: 5
- Tests: `scripts/ci/live-smoke.mts` — SIN LIBRO
- Prueba en vivo: `scripts/ci/live-smoke.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-NOT-WIRED-REGISTRY-001 — Registro NOT_WIRED + guard no-orphan de handlers L13–L18
- Epic: BF
- Invariantes: 5
- Tests: `tests/v22/not-wired-integrity.test.ts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-OBSERVABILITY-SLI-001 — Observabilidad SLI (ENG-054) con garantía PHI-free
- Epic: BG
- Invariantes: 5
- Tests: `tests/v22/observability-sli.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-observability-sli-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-BACKUP-DR-001 — Backup/DR + downtime mode (ENG-055) con recuperabilidad verificada
- Epic: BH
- Invariantes: 5
- Tests: `tests/v22/downtime-no-false-save.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-dr-recovery-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-COMPLIANCE-NOM-001 — Compliance-as-code: registro de aplicabilidad NOM (ENG-044)
- Epic: BI
- Invariantes: 5
- Tests: `tests/v22/nom-compliance-integrity.test.ts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DEV-IDENTITY-HARDENING-001 — Dev identity verifier imposible en producción (IAM hardening)
- Epic: BJ
- Invariantes: 5
- Tests: `tests/v22/dev-identity-prod-guard.test.ts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-IMMUNIZATION-FORECAST-001 — Pronóstico de vacunación por edad (cartilla México)
- Epic: BK
- Invariantes: 5
- Tests: `tests/v22/immunization-schedule.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-immunization-forecast-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-RENAL-EGFR-001 — Función renal estimada (eGFR CKD-EPI 2021) + estadificación ERC
- Epic: BL
- Invariantes: 5
- Tests: `tests/v22/renal-function.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-egfr-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-RENAL-DOSING-001 — Contraindicación renal por eGFR medido en la prescripción (7.ª barrera)
- Epic: BM
- Invariantes: 5
- Tests: `tests/v22/drug-catalog.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-renal-dosing-gate-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-LAB-DERIVATIONS-001 — Derivaciones de laboratorio multi-analito (anion gap, calcio corregido, sodio corregido, osmolalidad)
- Epic: BN+BY
- Invariantes: 6
- Tests: `tests/v22/lab-derivations.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-metabolic-panel-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ANTHROPOMETRICS-BMI-001 — IMC + clasificación nutricional WHO (antropometría)
- Epic: BO
- Invariantes: 5
- Tests: `tests/v22/anthropometrics.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-bmi-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-GLYCEMIC-CONTROL-001 — Control glucémico (HbA1c -> eAG + clasificación, marco diabético vs tamizaje)
- Epic: BP
- Invariantes: 5
- Tests: `tests/v22/glycemic.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-glycemic-status-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-STROKE-RISK-001 — CHA2DS2-VASc: riesgo de ictus en FA -> indicación de anticoagulación
- Epic: BQ
- Invariantes: 5
- Tests: `tests/v22/stroke-risk.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-cha2ds2vasc-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-LIVER-FIB4-001 — FIB-4: índice no invasivo de fibrosis hepática
- Epic: BR
- Invariantes: 5
- Tests: `tests/v22/liver-fibrosis.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-fib4-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CLINICAL-INTELLIGENCE-001 — Resumen de inteligencia clínica determinista (priorizado)
- Epic: BS+BV
- Invariantes: 6
- Tests: `tests/v22/clinical-summary.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-clinical-intelligence-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-BP-STAGING-001 — Estadificación de presión arterial (ACC/AHA 2017)
- Epic: BT
- Invariantes: 5
- Tests: `tests/v22/bp-staging.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-bp-stage-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ANTICOAG-INR-001 — Monitoreo terapéutico del INR en anticoagulación (TDM)
- Epic: BU
- Invariantes: 5
- Tests: `tests/v22/anticoagulation.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-anticoagulation-status-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-MELD-001 — MELD: pronóstico de hepatopatía avanzada
- Epic: BW
- Invariantes: 5
- Tests: `tests/v22/meld.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-meld-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ACID-BASE-001 — Interpretación ácido-base (gasometría + fórmula de Winters)
- Epic: BX
- Invariantes: 5
- Tests: `tests/v22/acid-base.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-acid-base-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PNEUMONIA-CURB65-001 — CURB-65: gravedad de neumonía -> decisión de ingreso
- Epic: BZ
- Invariantes: 5
- Tests: `tests/v22/pneumonia-severity.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-curb65-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-OXYGENATION-AA-001 — Gradiente alveolo-arterial de O2 (A-a), parametrizable por altitud
- Epic: CA
- Invariantes: 5
- Tests: `tests/v22/oxygenation.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-aa-gradient-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-AI-COPILOT-GATEWAY-001 — Choke point de seguridad del AI copilot (ADR-0220 fase 1, SIN IA)
- Epic: CB
- Invariantes: 6
- Tests: `tests/v22/ai-copilot-gateway.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-ai-copilot-gateway-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-AI-EVAL-HARNESS-001 — Eval harness + shadow mode del AI copilot (ADR-0220 fase 2, sin IA)
- Epic: CC
- Invariantes: 5
- Tests: `tests/v22/ai-eval-suite.test.ts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-COMORBIDITY-CHARLSON-001 — Índice de Comorbilidad de Charlson (predictor de mortalidad)
- Epic: CD
- Invariantes: 5
- Tests: `tests/v22/comorbidity.test.ts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-charlson-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONSULTATION-SNAPSHOT-001 — Snapshot de consulta (panel 1: Vista principal – Durante la consulta)
- Epic: CF
- Invariantes: 4
- Tests: `scripts/v22/live-consultation-snapshot-proof.mts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-consultation-snapshot-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-TRENDS-LONGITUDINAL-001 — Evolución longitudinal (panel 4: Resultados y tendencias)
- Epic: CH
- Invariantes: 4
- Tests: `scripts/v22/live-trends-proof.mts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-trends-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PRESCRIPTION-CHECK-001 — Prescripción segura – dry-run de verificación (panel 3)
- Epic: CG
- Invariantes: 5
- Tests: `scripts/v22/live-prescription-check-proof.mts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-prescription-check-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-UI-COCKPIT-001 — Cockpit del expediente + paneles de presentación (dashboard objetivo)
- Epic: CI-CK
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PATIENT-DEMOGRAPHICS-001 — Modelo de Paciente ampliado — CURP + contacto (México)
- Epic: CL
- Invariantes: 4
- Tests: `scripts/v22/live-patient-demographics-proof.mts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-patient-demographics-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-AGENDA-DAY-001 — Agenda del día — citas por consultorio/tipo/estado + consulta por fecha
- Epic: CM
- Invariantes: 4
- Tests: `scripts/v22/live-agenda-day-proof.mts` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-agenda-day-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DRUG-INTERACTION-SET-001 — Interacciones (conjunto) — pares fármaco-fármaco + factores del paciente, 4 niveles + mecanismo/recomendación
- Epic: BN
- Invariantes: 5
- Tests: `scripts/v22/live-interactions-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (Interacciones: chips por defecto, factores, hallazgos con severidad en texto)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-interactions-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ALLERGY-REGISTRY-001 — Registro de alergias (clínica-wide) — módulo Alergias cableado a SQL
- Epic: R/UI
- Invariantes: 5
- Tests: `scripts/v22/live-allergy-registry-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Alergias: KPIs, tabla, detalle, gráficas)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-allergy-registry-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PROBLEM-REGISTRY-001 — Registro de problemas (clínica-wide) + Nuevo problema + Plantillas — módulo Problemas cableado a SQL
- Epic: Q/UI
- Invariantes: 5
- Tests: `scripts/v22/live-problem-registry-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Problemas: KPIs, tabla, detalle, gráficas + navegación a form y plantillas)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-problem-registry-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-IMMUNIZATION-REGISTRY-001 — Registro de vacunas (clínica-wide) — módulo Vacunas cableado a SQL
- Epic: V/UI
- Invariantes: 5
- Tests: `scripts/v22/live-immunization-registry-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Vacunas: KPIs, tabla, detalle, cobertura)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-immunization-registry-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-VITALS-HISTORY-001 — Signos vitales — form cableado a POST + historial/tendencias por paciente cableados a SQL
- Epic: W/UI
- Invariantes: 5
- Tests: `scripts/v22/live-vitals-history-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Signos vitales: form, últimos registros, tendencias, referencia, alertas)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-vitals-history-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CARE-PLAN-SNAPSHOT-001 — Plan de cuidado — snapshot compuesto por paciente cableado a SQL
- Epic: X/UI
- Invariantes: 5
- Tests: `scripts/v22/live-care-plan-snapshot-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Plan de cuidado: problemas, objetivos, intervenciones, cronograma, métricas)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-care-plan-snapshot-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REFERRAL-CONTEXT-001 — Interconsultas — Nueva interconsulta con contexto compuesto + envío cableados a SQL
- Epic: Y/UI
- Invariantes: 5
- Tests: `scripts/v22/live-referral-context-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Interconsultas: form + panel de contexto + envío)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-referral-context-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-FOLLOW-UP-SNAPSHOT-001 — Seguimiento — snapshot compuesto por paciente (tareas + tendencia vitales + indicadores) cableado a SQL
- Epic: BA/UI
- Invariantes: 5
- Tests: `scripts/v22/live-follow-up-snapshot-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Seguimiento: historia, tendencia, indicadores, tareas, próxima cita)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-follow-up-snapshot-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CLAIMS-REGISTRY-001 — Facturación — registro de facturas clínica-wide + KPIs + emisión cableados a SQL
- Epic: Y/UI
- Invariantes: 5
- Tests: `scripts/v22/live-claims-registry-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Facturación: KPIs, tabla, wizard, gráficas)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-claims-registry-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DOCUMENTS-REGISTRY-001 — Documentos — lista por paciente + carpetas + generación cableadas a SQL
- Epic: Z/UI
- Invariantes: 5
- Tests: `scripts/v22/live-documents-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Documentos: carpetas, tabla, vista previa, acciones)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-documents-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REGULATORY-OBLIGATIONS-001 — Obligaciones regulatorias del consultorio — aggregate nuevo cableado a SQL
- Epic: AC/UI
- Invariantes: 5
- Tests: `scripts/v22/live-regulatory-obligations-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Obligaciones: KPIs, tabla, calendario, cumplimiento)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-regulatory-obligations-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REPORTS-DASHBOARD-001 — Reportes — tablero analítico del consultorio (KPIs + diagnósticos cableados a SQL)
- Epic: AD/UI
- Invariantes: 5
- Tests: `scripts/v22/live-reports-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Reportes: KPIs, diagnósticos, gráficas)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-reports-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-RESULTS-REGISTRY-001 — Resultados — registro clínica-wide cableado a SQL (estado-UI derivado + KPIs)
- Epic: AQ/UI
- Invariantes: 5
- Tests: `scripts/v22/live-results-registry-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Resultados: KPIs + lista con estado-UI)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-results-registry-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-RESULTS-TABS-001 — Resultados — pestañas Solicitudes/Alertas/Seguimiento/Valores de referencia cableadas
- Epic: E/AQ/UI
- Invariantes: 5
- Tests: `scripts/v22/live-orders-registry-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (Resultados: Solicitudes/Alertas/Valores de referencia)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-orders-registry-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONSULTATION-TABS-001 — Consulta — 6 pestañas por paciente cableadas (snapshot compuesto)
- Epic: K/UI
- Invariantes: 5
- Tests: `scripts/v22/live-consultation-tabs-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (Consulta: pestañas Resultados/Medicamentos/Seguimiento)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-consultation-tabs-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ORDERS-LIFECYCLE-UI-001 — Órdenes — módulo funcional de punta a punta (crear + ciclo de vida + navegación interconectada)
- Epic: M/UI
- Invariantes: 6
- Tests: `scripts/v22/live-orders-registry-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Órdenes: KPIs/lista/detalle/creador)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-orders-registry-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-MEDICATIONS-CATALOG-UI-001 — Medicamentos — catálogo determinista real + Alertas de seguridad + interconexión a prescripción
- Epic: AP/UI
- Invariantes: 5
- Tests: `tests/v22/drug-catalog.test.ts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Medicamentos: catálogo/detalle/alertas)` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-AGENDA-LIFECYCLE-UI-001 — Agenda — navegación de fecha en vivo + ciclo de vida de la cita + creación (interconectado)
- Epic: CM/UI
- Invariantes: 6
- Tests: `scripts/v22/live-agenda-day-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (vista Agenda: citas/detalle/ciclo de vida/nueva cita/lista)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-agenda-day-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONSULTA-ENCOUNTER-UI-001 — Consulta — documentación cableada al encuentro REAL (abrir → valorar → firmar, con gate de firma)
- Epic: D/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Consulta: abrir -> valorar -> firmar)` — SIN LIBRO; `scripts/v22/live-encounter-lifecycle-proof.mts` — SIN LIBRO; `scripts/v22/live-result-closed-loop-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONSULTA-VITALS-UI-001 — Consulta — signos vitales cableados a POST /vitals (con interpretación crítica y gate de firma)
- Epic: D/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Consulta: guardar signos vitales -> POST /vitals)` — SIN LIBRO; `scripts/v22/live-critical-vital-signing-loop-proof.mts` — SIN LIBRO; `scripts/v22/live-vitals-history-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONSULTA-ORDERS-UI-001 — Consulta — crear órdenes clínicas reales desde el formulario (POST /orders)
- Epic: M/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Consulta: seleccionar estudio -> Crear orden -> POST /orders)` — SIN LIBRO; `scripts/v22/live-orders-registry-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONSULTA-PROBLEMS-UI-001 — Consulta — agregar diagnósticos CIE-10 reales a la lista de problemas (POST /problems)
- Epic: Q/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Consulta: buscar CIE-10 -> elegir -> POST /problems)` — SIN LIBRO; `scripts/v22/live-problem-registry-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ALLERGIES-CREATE-UI-001 — Alergias — registro inline real desde el módulo (POST /allergies), alimenta el gate de prescripción
- Epic: R/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Alergias: registrar alergia -> POST /allergies)` — SIN LIBRO; `scripts/v22/live-allergy-registry-proof.mts` — SIN LIBRO; `scripts/v22/live-allergy-medication-gate-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-IMMUNIZATIONS-CREATE-UI-001 — Vacunas — registro inline real (POST /immunizations; administra si hay lote+sitio)
- Epic: S/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Vacunas: registrar vacuna -> POST /immunizations)` — SIN LIBRO; `scripts/v22/live-immunization-registry-proof.mts` — SIN LIBRO; `scripts/v22/live-immunization-forecast-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DOCUMENTS-CREATE-UI-001 — Documentos — crear documento clínico real desde el módulo (POST /documents)
- Epic: BD/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Documentos: crear documento -> POST /documents)` — SIN LIBRO; `scripts/v22/live-documents-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-BILLING-PATIENT-UI-001 — Facturación — emisión real con selector de paciente cableado (POST /claims)
- Epic: BE/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Facturacion: elegir paciente -> Emitir -> POST /claims)` — SIN LIBRO; `scripts/v22/live-claims-registry-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REFERRALS-PATIENT-UI-001 — Interconsultas — envío real con selector de paciente cableado (POST /referrals)
- Epic: BF/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Interconsultas: elegir paciente + motivo -> Enviar -> POST /referrals)` — SIN LIBRO; `scripts/v22/live-referral-context-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-RESULTS-CREATE-UI-001 — Resultados — registrar resultado real con interpretación derivada por CDS (POST /results)
- Epic: AQ/UI
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Resultados: registrar resultado -> POST /results)` — SIN LIBRO; `scripts/v22/live-results-registry-proof.mts` — SIN LIBRO; `scripts/v22/live-result-closed-loop-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-VITALS-MODULE-PATIENT-UI-001 — Signos vitales — registro por módulo con selector de paciente cableado (POST /vitals)
- Epic: BB/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (vista Signos vitales: elegir paciente + FC -> Guardar -> POST /vitals)` — SIN LIBRO; `scripts/v22/live-vitals-history-proof.mts` — SIN LIBRO; `scripts/v22/live-critical-vital-signing-loop-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PATIENTS-FICHA-EDIT-UI-001 — Pacientes — ficha contextual con pestañas en sitio y edición REAL (AMENDED)
- Epic: IDENT/UI
- Invariantes: 5
- Tests: `scripts/v22/live-patient-amend-proof.mts` — SIN LIBRO; `tests/v22/ui-cockpit-render.test.tsx (Pacientes: ficha contextual + Historial en sitio + edición real + Agendar cita)` — SIN LIBRO
- Prueba en vivo: `scripts/v22/live-patient-amend-proof.mts` — SIN LIBRO
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CLINICALINTEL-AUDIT-DEEP-001 — Clinical Intelligence — auditoría boton por boton: IA generativa simulada eliminada (R6 en pausa), determinista real
- Epic: S-CLINICALINTEL/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Clinical Intelligence S-CLINICALINTEL: Apoyo clinico determinista + Alertas + Calculadoras + nota de pausa; Asistente clinico con IA/GPT Clinico/Diagnostico diferencial (IA)/Configuracion de IA === null)` — SIN LIBRO; `scripts/v22/live-clinical-intelligence-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONFIGURACION-AUDIT-DEEP-001 — Configuración — auditoría: ajustes presentacionales honestos; sin control destructivo falso ni toggle de IA (R6)
- Epic: S-CONFIG/UI
- Invariantes: 4
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Configuracion S-CONFIG: banner presentacional + Guardar; Eliminar mi cuenta y Sugerencias de diagnostico con IA === null)` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PHYSICIAN-PROFILE-SIGNATURE-BLOB-BACKEND-001 — Configuración — firma y sello del médico (imágenes) en Vercel Blob privado, por-usuario
- Epic: S-CONFIG/FIRMA
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Configuración: Firma y sello con estado honesto 'Sin firma/sello cargada', sin firma inventada)` — SIN LIBRO; `scripts/v22/live-physician-profile-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-DOCUMENT-ATTACHMENTS-BLOB-BACKEND-001 — Documentos — adjuntos binarios (PHI) en Vercel Blob privado: subir, ver y quitar
- Epic: S-DOCUMENTOS/BLOB
- Invariantes: 5
- Tests: `tests/v22/ui-cockpit-render.test.tsx (Documentos: tipos/límite reales -> 25 MB y Vercel Blob presentes, DICOM eliminado)` — SIN LIBRO; `scripts/v22/live-document-attachment-proof.mts` — SIN LIBRO
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

## Firma de aceptación C5 (humana)

> Las decisiones «APPROVED_WITH_EVIDENCE» de la sección anterior son **propuestas generadas por un agente**, no aceptaciones.
> Capacidades con firma humana registrada en este dossier: **0 de 150**. Mientras esta tabla esté vacía,
> ninguna capacidad C5 está aceptada, y así lo declara ADR-0300 entre las condiciones de decisión del dueño.

| Capacidad | Decisión C5 (ACEPTA/RECHAZA) | Revisor | Fecha | Notas |
| --- | --- | --- | --- | --- |
| CAP-VERTICAL-ENCOUNTER-001 | | | | |
| CAP-ENCOUNTER-RUNTIME-003 | | | | |
| CAP-VERTICAL-RESULT-001 | | | | |
| CAP-MED-AUTH-003 | | | | |
| CAP-AMENDMENT-001 | | | | |
| CAP-SESSION-001 | | | | |
| CAP-IDENTITY-001 | | | | |
| CAP-AUTHZ-001 | | | | |
| CAP-UUID-BOUNDARY-001 | | | | |
| CAP-ORDER-RESULT-001 | | | | |
| CAP-APP-001 | | | | |
| CAP-OBLIGATION-002 | | | | |
| CAP-PATIENT-STATE-002 | | | | |
| CAP-PROBLEM-GRAPH-001 | | | | |
| CAP-ALLERGY-001 | | | | |
| CAP-PATIENT-001 | | | | |
| CAP-REFERRAL-001 | | | | |
| CAP-APPOINTMENT-001 | | | | |
| CAP-IMMUNIZATION-001 | | | | |
| CAP-VITAL-001 | | | | |
| CAP-CAREPLAN-001 | | | | |
| CAP-CLAIM-001 | | | | |
| CAP-CONSENT-001 | | | | |
| CAP-CAREGAPS-001 | | | | |
| CAP-RECORD-EXPORT-001 | | | | |
| CAP-PANEL-WORKLIST-001 | | | | |
| CAP-ADJUDICATION-001 | | | | |
| CAP-ADMISSION-001 | | | | |
| CAP-SPECIMEN-001 | | | | |
| CAP-INCIDENT-001 | | | | |
| CAP-TRIAGE-001 | | | | |
| CAP-WOUND-001 | | | | |
| CAP-TRANSFUSION-001 | | | | |
| CAP-SURGERY-001 | | | | |
| CAP-DIALYSIS-001 | | | | |
| CAP-TERMINOLOGY-001 | | | | |
| CAP-VITALS-REF-001 | | | | |
| CAP-CRITICAL-VITAL-GAP-001 | | | | |
| CAP-DRUG-ALLERGY-001 | | | | |
| CAP-BILLING-ICD10-001 | | | | |
| CAP-CRITICAL-VITAL-LOOP-001 | | | | |
| CAP-CLINICAL-INTEL-001 | | | | |
| CAP-LAB-REF-002 | | | | |
| CAP-MED-VALIDATION-001 | | | | |
| CAP-DUPLICATE-THERAPY-001 | | | | |
| CAP-DRUG-INTERACTION-001 | | | | |
| CAP-DRUG-CONDITION-001 | | | | |
| CAP-DOSE-CEILING-001 | | | | |
| CAP-MONITORING-OBLIGATION-001 | | | | |
| CAP-LAB-DELTA-001 | | | | |
| CAP-NEWS2-001 | | | | |
| CAP-PEDIATRIC-DOSE-001 | | | | |
| CAP-LIVE-REGRESSION-001 | | | | |
| CAP-NOT-WIRED-REGISTRY-001 | | | | |
| CAP-OBSERVABILITY-SLI-001 | | | | |
| CAP-BACKUP-DR-001 | | | | |
| CAP-COMPLIANCE-NOM-001 | | | | |
| CAP-DEV-IDENTITY-HARDENING-001 | | | | |
| CAP-IMMUNIZATION-FORECAST-001 | | | | |
| CAP-RENAL-EGFR-001 | | | | |
| CAP-RENAL-DOSING-001 | | | | |
| CAP-LAB-DERIVATIONS-001 | | | | |
| CAP-ANTHROPOMETRICS-BMI-001 | | | | |
| CAP-GLYCEMIC-CONTROL-001 | | | | |
| CAP-STROKE-RISK-001 | | | | |
| CAP-LIVER-FIB4-001 | | | | |
| CAP-CLINICAL-INTELLIGENCE-001 | | | | |
| CAP-BP-STAGING-001 | | | | |
| CAP-ANTICOAG-INR-001 | | | | |
| CAP-MELD-001 | | | | |
| CAP-ACID-BASE-001 | | | | |
| CAP-PNEUMONIA-CURB65-001 | | | | |
| CAP-OXYGENATION-AA-001 | | | | |
| CAP-AI-COPILOT-GATEWAY-001 | | | | |
| CAP-AI-EVAL-HARNESS-001 | | | | |
| CAP-COMORBIDITY-CHARLSON-001 | | | | |
| CAP-CONSULTATION-SNAPSHOT-001 | | | | |
| CAP-TRENDS-LONGITUDINAL-001 | | | | |
| CAP-PRESCRIPTION-CHECK-001 | | | | |
| CAP-UI-COCKPIT-001 | | | | |
| CAP-PATIENT-DEMOGRAPHICS-001 | | | | |
| CAP-AGENDA-DAY-001 | | | | |
| CAP-DRUG-INTERACTION-SET-001 | | | | |
| CAP-ALLERGY-REGISTRY-001 | | | | |
| CAP-PROBLEM-REGISTRY-001 | | | | |
| CAP-IMMUNIZATION-REGISTRY-001 | | | | |
| CAP-VITALS-HISTORY-001 | | | | |
| CAP-CARE-PLAN-SNAPSHOT-001 | | | | |
| CAP-REFERRAL-CONTEXT-001 | | | | |
| CAP-FOLLOW-UP-SNAPSHOT-001 | | | | |
| CAP-CLAIMS-REGISTRY-001 | | | | |
| CAP-DOCUMENTS-REGISTRY-001 | | | | |
| CAP-REGULATORY-OBLIGATIONS-001 | | | | |
| CAP-CLINICAL-INTELLIGENCE-UI-001 | | | | |
| CAP-REPORTS-DASHBOARD-001 | | | | |
| CAP-CLINICAL-LIBRARY-UI-001 | | | | |
| CAP-SETTINGS-UI-001 | | | | |
| CAP-RESULTS-REGISTRY-001 | | | | |
| CAP-RESULTS-TABS-001 | | | | |
| CAP-CONSULTATION-TABS-001 | | | | |
| CAP-ORDERS-LIFECYCLE-UI-001 | | | | |
| CAP-MEDICATIONS-CATALOG-UI-001 | | | | |
| CAP-AGENDA-LIFECYCLE-UI-001 | | | | |
| CAP-PATIENTS-UI-001 | | | | |
| CAP-CONSULTA-ENCOUNTER-UI-001 | | | | |
| CAP-INICIO-DASHBOARD-UI-001 | | | | |
| CAP-CONSULTA-VITALS-UI-001 | | | | |
| CAP-CONSULTA-ORDERS-UI-001 | | | | |
| CAP-CONSULTA-PROBLEMS-UI-001 | | | | |
| CAP-CONSULTA-ANTECEDENTES-UI-001 | | | | |
| CAP-ALLERGIES-CREATE-UI-001 | | | | |
| CAP-IMMUNIZATIONS-CREATE-UI-001 | | | | |
| CAP-CAREPLAN-CREATE-UI-001 | | | | |
| CAP-DOCUMENTS-CREATE-UI-001 | | | | |
| CAP-REGULATORY-OBLIGATIONS-CREATE-UI-001 | | | | |
| CAP-BILLING-PATIENT-UI-001 | | | | |
| CAP-REFERRALS-PATIENT-UI-001 | | | | |
| CAP-RESULTS-CREATE-UI-001 | | | | |
| CAP-VITALS-MODULE-PATIENT-UI-001 | | | | |
| CAP-PATIENTS-FICHA-EDIT-UI-001 | | | | |
| CAP-CONSULTA-PANEL-UI-001 | | | | |
| CAP-CONSULTA-AUDIT-DEEP-001 | | | | |
| CAP-AGENDA-AUDIT-DEEP-001 | | | | |
| CAP-RESULTADOS-AUDIT-DEEP-001 | | | | |
| CAP-MEDICAMENTOS-AUDIT-DEEP-001 | | | | |
| CAP-ORDENES-AUDIT-DEEP-001 | | | | |
| CAP-ALERGIAS-AUDIT-DEEP-001 | | | | |
| CAP-PROBLEMAS-AUDIT-DEEP-001 | | | | |
| CAP-VACUNAS-AUDIT-DEEP-001 | | | | |
| CAP-SIGNOS-AUDIT-DEEP-001 | | | | |
| CAP-PLANCUIDADO-AUDIT-DEEP-001 | | | | |
| CAP-INTERCONSULTA-AUDIT-DEEP-001 | | | | |
| CAP-SEGUIMIENTO-AUDIT-DEEP-001 | | | | |
| CAP-FACTURACION-AUDIT-DEEP-001 | | | | |
| CAP-DOCUMENTOS-AUDIT-DEEP-001 | | | | |
| CAP-OBLIGACIONES-AUDIT-DEEP-001 | | | | |
| CAP-CLINICALINTEL-AUDIT-DEEP-001 | | | | |
| CAP-REPORTES-AUDIT-DEEP-001 | | | | |
| CAP-BIBLIOTECA-AUDIT-DEEP-001 | | | | |
| CAP-CONFIGURACION-AUDIT-DEEP-001 | | | | |
| CAP-OFFICE-SETTINGS-BACKEND-001 | | | | |
| CAP-OFFICE-SETTINGS-SCHEDULE-BACKEND-001 | | | | |
| CAP-OFFICE-SETTINGS-PREFS-BACKEND-001 | | | | |
| CAP-PHYSICIAN-PROFILE-SIGNATURE-BLOB-BACKEND-001 | | | | |
| CAP-DOCUMENT-REPOSITORY-BACKEND-001 | | | | |
| CAP-DOCUMENT-ATTACHMENTS-BLOB-BACKEND-001 | | | | |
| CAP-REPORTES-AGGREGATES-BACKEND-001 | | | | |
| CAP-REPORTES-TRENDS-BACKEND-001 | | | | |
| CAP-REPORTES-APPTTYPES-BACKEND-001 | | | | |
| CAP-REPORTES-QUALITY-BACKEND-001 | | | | |
