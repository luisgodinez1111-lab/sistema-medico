# Dossier de aceptación C5 — Medical OS V2

**Generado automáticamente** por `scripts/v22/build-c5-dossier.mts`. NO es autoridad: es el paquete de evidencia
para que un revisor humano C5 acepte (o rechace) cada capacidad reconciliada. La aceptación se registra firmando la tabla al final.

- Capacidades reconciliadas: **33**
- Estado de evidencia: **COMPLETA ✅ (todo test/prueba citada existe en disco)**
- Pendiente de aceptación humana C5: **33**

## Riesgo C4

### CAP-AUTHZ-001 — Tenant/Role/Scope/Purpose Authorization
- Epic: RBAC
- Invariantes: 3
- Tests: `tests/v22/session-issuance.test.ts (scopesForRoles + union)`, `tests/security/authz.test.ts`
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-APP-001 — Clinical Application Service Layer
- Epic: K (UI)
- Invariantes: 1
- Tests: `tests/v22/session-client.test.ts`
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ADJUDICATION-001 — Validador de evidencia de adjudicación + dossier de aceptación C5 (turnkey)
- Epic: AD
- Invariantes: 4
- Tests: `tests/v22/reconciliation-integrity.test.ts`
- Prueba en vivo: `scripts/v22/build-c5-dossier.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

## Riesgo C5

### CAP-VERTICAL-ENCOUNTER-001 — Authenticated Encounter Vertical Slice
- Epic: B
- Invariantes: 3
- Tests: `tests/v22/http-principal.test.ts`
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ENCOUNTER-RUNTIME-003 — Executable Encounter Assess/Sign Runtime
- Epic: D + UI
- Invariantes: 4
- Tests: `tests/v22/encounter-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-encounter-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-VERTICAL-RESULT-001 — Result-to-Obligation Closed Loop
- Epic: G
- Invariantes: 3
- Tests: `tests/v22/result-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-result-closed-loop-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-MED-AUTH-003 — Medication Prescribing Authority Boundary
- Epic: H + UI
- Invariantes: 3
- Tests: `tests/v22/medication-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-medication-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-AMENDMENT-001 — Immutable Signed-Record Amendment Ledger
- Epic: I
- Invariantes: 4
- Tests: `tests/v22/document-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-document-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-SESSION-001 — Signed Session & Principal Integrity
- Epic: E
- Invariantes: 3
- Tests: `tests/v22/session-issuance.test.ts`
- Prueba en vivo: `scripts/v22/live-session-issuance-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-IDENTITY-001 — Identity, Tenant & Clinical Access Boundary
- Epic: F
- Invariantes: 3
- Tests: `tests/v22/oidc-verifier.test.ts`
- Prueba en vivo: `scripts/v22/live-oidc-login-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-UUID-BOUNDARY-001 — Strict UUID Persistence Boundary
- Epic: actorId-fix
- Invariantes: 1
- Tests: `tests/v22/http-principal.test.ts (subjectToActorId)`
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ORDER-RESULT-001 — Order & Result Closed Loop (order lifecycle)
- Epic: M
- Invariantes: 4
- Tests: `tests/v22/order-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-order-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-OBLIGATION-002 — Clinical Obligation Domain (follow-up)
- Epic: O
- Invariantes: 3
- Tests: `tests/v22/obligation-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-obligation-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PATIENT-STATE-002 — Computed Patient State Composer (resumen del paciente)
- Epic: P
- Invariantes: 2
- Tests: `tests/v22/patient-summary.test.ts`
- Prueba en vivo: —
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PROBLEM-GRAPH-001 — Problem list (Problem/Hypothesis/Evidence Graph surface)
- Epic: Q
- Invariantes: 3
- Tests: `tests/v22/problem-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-problem-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ALLERGY-001 — Allergy list + medication safety gate (NUEVA, no en catalogo)
- Epic: R
- Invariantes: 3
- Tests: `tests/v22/allergy-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-allergy-medication-gate-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PATIENT-001 — Registro longitudinal de pacientes (agregado Patient, identidad clinica)
- Epic: S
- Invariantes: 4
- Tests: `tests/v22/patient-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-patient-registry-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-REFERRAL-001 — Interconsultas/referencias a especialista (agregado Referral)
- Epic: T
- Invariantes: 4
- Tests: `tests/v22/referral-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-referral-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-APPOINTMENT-001 — Agenda/citas (agregado Appointment, scheduling)
- Epic: U
- Invariantes: 4
- Tests: `tests/v22/appointment-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-appointment-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-IMMUNIZATION-001 — Vacunas/inmunizaciones (agregado Immunization, cartilla longitudinal)
- Epic: V
- Invariantes: 4
- Tests: `tests/v22/immunization-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-immunization-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-VITAL-001 — Signos vitales/observaciones (agregado VitalSign, append-only con corrección)
- Epic: W
- Invariantes: 4
- Tests: `tests/v22/vital-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-vital-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CAREPLAN-001 — Plan de cuidados/metas de crónicos (agregado CarePlan, care gaps longitudinales)
- Epic: X
- Invariantes: 4
- Tests: `tests/v22/careplan-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-careplan-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CLAIM-001 — Facturación/reclamaciones (agregado Claim, ciclo de ingresos)
- Epic: Y
- Invariantes: 4
- Tests: `tests/v22/claim-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-claim-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CONSENT-001 — Consentimiento informado (agregado Consent, registro clínico-legal)
- Epic: Z
- Invariantes: 4
- Tests: `tests/v22/consent-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-consent-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-CAREGAPS-001 — Motor de care gaps / worklist clínico (inteligencia por reglas, cross-vertical)
- Epic: AA
- Invariantes: 4
- Tests: `tests/v22/care-gaps.test.ts`
- Prueba en vivo: `scripts/v22/live-care-gaps-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-RECORD-EXPORT-001 — Export/manifiesto del expediente con hash reproducible (interoperabilidad NOM-024)
- Epic: AB
- Invariantes: 4
- Tests: `tests/v22/record-export.test.ts`
- Prueba en vivo: `scripts/v22/live-record-export-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-PANEL-WORKLIST-001 — Worklist poblacional / panel del clínico (population health, cross-patient)
- Epic: AC
- Invariantes: 4
- Tests: `tests/v22/care-gaps.test.ts`
- Prueba en vivo: `scripts/v22/live-panel-worklist-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-ADMISSION-001 — Internamiento/hospitalización (agregado Admission, episodio de cuidado / censo)
- Epic: AE
- Invariantes: 4
- Tests: `tests/v22/admission-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-admission-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-SPECIMEN-001 — Trazabilidad de muestras / cadena de custodia de laboratorio (fase pre-analítica)
- Epic: AF
- Invariantes: 4
- Tests: `tests/v22/specimen-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-specimen-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-INCIDENT-001 — Incidentes de seguridad del paciente / farmacovigilancia (agregado Incident)
- Epic: AG
- Invariantes: 4
- Tests: `tests/v22/incident-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-incident-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-TRIAGE-001 — Triage / clasificación de acuidad (agregado Triage, front-of-house urgencias)
- Epic: AH
- Invariantes: 5
- Tests: `tests/v22/triage-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-triage-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-WOUND-001 — Cuidado de heridas / lesiones por presión (agregado Wound, valoración longitudinal)
- Epic: AI
- Invariantes: 4
- Tests: `tests/v22/wound-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-wound-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

### CAP-TRANSFUSION-001 — Transfusión sanguínea (agregado Transfusion, medicina transfusional / hemovigilancia)
- Epic: AJ
- Invariantes: 5
- Tests: `tests/v22/transfusion-fold.test.ts`
- Prueba en vivo: `scripts/v22/live-transfusion-lifecycle-proof.mts`
- Decisión propuesta: APPROVED_WITH_EVIDENCE

## Firma de aceptación C5 (humana)

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
