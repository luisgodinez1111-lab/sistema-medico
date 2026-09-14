import {
  pgTable,
  pgEnum,
  text,
  date,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import type {
  AllergyId,
  ConditionId,
  ConsentId,
  DiagnosticReportId,
  EncounterId,
  EncounterDiagnosisId,
  EncounterAddendumId,
  ExamFindingId,
  HistoryEntryId,
  MedicationRequestId,
  ObservationId,
  PatientId,
  PractitionerId,
  RelatedPersonId,
  ServiceRequestId,
  TenantId,
  UserId,
} from '@medical-os/shared';

/**
 * NIVEL 3 — Clinical Data Foundation (§NIVEL 3, ADR-0003).
 *
 * `patient` es PHI: aplican todas las reglas del ADR-0003.
 * - Tenant-scoped: `tenant_id NOT NULL` + índices compuestos (ADR-0002).
 * - ID interno = ULID no predecible, SEPARADO de identificadores externos
 *   (MRN, CURP) que sí pueden ser legibles/conocidos (§33).
 * - Borrado LÓGICO y auditado (`deleted_at`), nunca destructivo (ADR-0003 §8).
 * - Soporta resolución de duplicados por `merged_into_id` (§28 paso 2).
 * - `dedup_key` es una clave normalizada (nombre+fecha) para DETECTAR posibles
 *   duplicados; es una señal, no una restricción de unicidad (gemelos, homónimos).
 */

export const patientSex = pgEnum('patient_sex', ['female', 'male', 'other', 'unknown']);
export const patientStatus = pgEnum('patient_status', ['active', 'inactive', 'deceased', 'merged']);

export const patient = pgTable(
  'patient',
  {
    id: text('id').primaryKey().$type<PatientId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),

    /** Número de expediente legible, único por tenant (identificador externo). */
    mrn: text('mrn').notNull(),
    /** CURP (MX) u otro identificador nacional; opcional, único por tenant si existe. */
    curp: text('curp'),

    /** Nombre desglosado (convención MX): nombres + apellido paterno + materno. */
    givenNames: text('given_names').notNull(),
    firstSurname: text('first_surname').notNull(),
    secondSurname: text('second_surname'),

    /** Fecha de nacimiento: necesaria para edad e historia adaptativa (§NIVEL 5). */
    birthDate: date('birth_date').notNull(),
    sex: patientSex('sex').notNull().default('unknown'),

    /** Contacto (PHI). */
    phone: text('phone'),
    email: text('email'),

    /** Clave normalizada para detección de duplicados (no única). */
    dedupKey: text('dedup_key').notNull(),

    status: patientStatus('status').notNull().default('active'),
    /** Si se fusionó como duplicado, apunta al paciente superviviente. */
    mergedIntoId: text('merged_into_id').$type<PatientId>(),

    /**
     * Fecha de la última revisión del estado de alergias. Permite distinguir
     * "sin alergias conocidas" (revisado, NULL de alergias) de "no evaluado"
     * (este campo NULL) — nunca se colapsa ausencia de dato con negativo (§27).
     */
    allergiesReviewedAt: timestamp('allergies_reviewed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    /** Borrado lógico: fecha de baja. NULL = activo (ADR-0003 §8). */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('patient_tenant_idx').on(t.tenantId),
    uniqueIndex('patient_tenant_mrn_idx').on(t.tenantId, t.mrn),
    // CURP único por tenant cuando existe (múltiples NULL permitidos en Postgres).
    uniqueIndex('patient_tenant_curp_idx').on(t.tenantId, t.curp),
    // Señal de duplicados: misma persona probable dentro del tenant.
    index('patient_tenant_dedup_idx').on(t.tenantId, t.dedupKey),
  ],
);

/**
 * Alergias/intolerancias del paciente (§NIVEL 3, alineado con FHIR
 * AllergyIntolerance). Dato de SEGURIDAD de primera clase: alimenta el
 * AllergyBanner y, más adelante, los chequeos de prescripción (§NIVEL 8).
 *
 * - Tenant-scoped + patient-scoped; `deleted_at` para baja lógica (ADR-0003 §8).
 * - `criticality` gobierna la prominencia de la alerta; no se esconde tras
 *   badges ambiguos (§27).
 */
export const allergyCategory = pgEnum('allergy_category', [
  'medication',
  'food',
  'environment',
  'biologic',
  'other',
]);
export const allergyCriticality = pgEnum('allergy_criticality', [
  'low',
  'high',
  'unable-to-assess',
]);
export const allergyClinicalStatus = pgEnum('allergy_clinical_status', [
  'active',
  'inactive',
  'resolved',
]);

export const allergy = pgTable(
  'allergy',
  {
    id: text('id').primaryKey().$type<AllergyId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),

    /** Sustancia/alérgeno, p.ej. "Penicilina". */
    substance: text('substance').notNull(),
    category: allergyCategory('category').notNull().default('medication'),
    criticality: allergyCriticality('criticality').notNull().default('unable-to-assess'),
    /** Manifestación/reacción, p.ej. "anafilaxia". */
    reaction: text('reaction'),
    clinicalStatus: allergyClinicalStatus('clinical_status').notNull().default('active'),
    note: text('note'),

    /** Quién y cuándo registró (provenance mínima, §NIVEL 3). */
    recordedBy: text('recorded_by').$type<UserId>(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('allergy_tenant_idx').on(t.tenantId),
    index('allergy_tenant_patient_idx').on(t.tenantId, t.patientId),
  ],
);

/**
 * Problemas/diagnósticos del paciente (§NIVEL 3, alineado con FHIR Condition).
 * Alimenta la lista de "Problemas activos" del Patient Workspace y, más
 * adelante, el plan y la receta (§28 paso 7).
 *
 * - Tenant- y patient-scoped; baja lógica (`deleted_at`, ADR-0003 §8).
 * - `code`/`codeSystem` permiten adjuntar codificación (ICD-10/SNOMED) después
 *   sin migrar: hoy `code` guarda el texto clínico legible.
 */
export const conditionClinicalStatus = pgEnum('condition_clinical_status', [
  'active',
  'recurrence',
  'relapse',
  'inactive',
  'remission',
  'resolved',
]);

export const condition = pgTable(
  'condition',
  {
    id: text('id').primaryKey().$type<ConditionId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),

    /** Problema/diagnóstico legible, p.ej. "Diabetes mellitus tipo 2". */
    code: text('code').notNull(),
    /** Sistema de codificación opcional, p.ej. "ICD-10". */
    codeSystem: text('code_system'),
    clinicalStatus: conditionClinicalStatus('clinical_status').notNull().default('active'),
    /** Fecha de inicio (onset), si se conoce. */
    onsetDate: date('onset_date'),
    note: text('note'),

    recordedBy: text('recorded_by').$type<UserId>(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('condition_tenant_idx').on(t.tenantId),
    index('condition_tenant_patient_idx').on(t.tenantId, t.patientId),
  ],
);

/**
 * Observaciones del paciente (§NIVEL 3, alineado con FHIR Observation).
 * Arranca con signos vitales; `category` permite extender a laboratorio/examen.
 *
 * - Tenant- y patient-scoped; baja lógica (`deleted_at`, ADR-0003 §8).
 * - `value_text` + `unit` mantienen flexibilidad (p.ej. TA "138/86" mmHg). Una
 *   columna numérica para tendencias se añadirá cuando NIVEL 5 la requiera.
 * - `effective_at` = momento de la medición (distinto de `recorded_at`).
 */
export const observationCategory = pgEnum('observation_category', [
  'vital-signs',
  'laboratory',
  'exam',
  'other',
]);

export const observation = pgTable(
  'observation',
  {
    id: text('id').primaryKey().$type<ObservationId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),

    category: observationCategory('category').notNull().default('vital-signs'),
    /** Qué se midió, p.ej. "blood-pressure", "weight", "temperature". */
    code: text('code').notNull(),
    /** Valor legible, p.ej. "138/86", "72", "36.7". */
    valueText: text('value_text').notNull(),
    unit: text('unit'),
    note: text('note'),

    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull().defaultNow(),
    recordedBy: text('recorded_by').$type<UserId>(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('observation_tenant_idx').on(t.tenantId),
    index('observation_tenant_patient_idx').on(t.tenantId, t.patientId),
  ],
);

/**
 * Personas relacionadas con el paciente (§NIVEL 3, alineado con FHIR
 * RelatedPerson): tutor/padre/madre, contacto de emergencia, cuidador. Clave en
 * pediatría y para consentimiento/contacto (§26).
 *
 * - Tenant- y patient-scoped; baja lógica (`deleted_at`, ADR-0003 §8).
 * - `is_emergency_contact` permite resaltar a quién llamar primero.
 */
export const relationshipType = pgEnum('related_person_relationship', [
  'mother',
  'father',
  'guardian',
  'spouse',
  'sibling',
  'child',
  'caregiver',
  'emergency-contact',
  'other',
]);

export const relatedPerson = pgTable(
  'related_person',
  {
    id: text('id').primaryKey().$type<RelatedPersonId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),

    /** Nombre completo de la persona relacionada (PHI). */
    name: text('name').notNull(),
    relationship: relationshipType('relationship').notNull().default('other'),
    phone: text('phone'),
    email: text('email'),
    isEmergencyContact: boolean('is_emergency_contact').notNull().default(false),
    note: text('note'),

    recordedBy: text('recorded_by').$type<UserId>(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('related_person_tenant_idx').on(t.tenantId),
    index('related_person_tenant_patient_idx').on(t.tenantId, t.patientId),
  ],
);

/**
 * Historia clínica ESTRUCTURADA (§NIVEL 5). Cada ítem es una fila, NUNCA un JSON
 * gigante ni un campo de texto único (§33, decisión prohibida #1). Qué secciones
 * e ítems aplican se computa server-side de forma ADAPTATIVA según edad/sexo
 * (motor en `clinical-history.ts`), con versión de contenido para gobernanza.
 *
 * - Tenant- y patient-scoped; baja lógica (`deleted_at`).
 * - `section` y `code` identifican el ítem; único por paciente e ítem activo.
 * - `schema_version` registra con qué versión del cuestionario se capturó.
 */
export const historyEntry = pgTable(
  'history_entry',
  {
    id: text('id').primaryKey().$type<HistoryEntryId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),

    /** Sección del cuestionario, p.ej. "heredofamiliares", "perinatales". */
    section: text('section').notNull(),
    /** Ítem dentro de la sección, p.ej. "diabetes", "parto". */
    code: text('code').notNull(),
    /** Respuesta/valor capturado (texto libre gobernado por el ítem). */
    value: text('value').notNull(),
    note: text('note'),
    /** Versión del esquema adaptativo con que se capturó (gobernanza, §33 #8). */
    schemaVersion: text('schema_version').notNull(),

    recordedBy: text('recorded_by').$type<UserId>(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('history_entry_tenant_idx').on(t.tenantId),
    index('history_entry_tenant_patient_idx').on(t.tenantId, t.patientId),
    // Un ítem (section+code) por paciente: permite upsert determinista.
    uniqueIndex('history_entry_patient_item_idx').on(t.tenantId, t.patientId, t.section, t.code),
  ],
);

/**
 * Encuentro clínico (§NIVEL 6, alineado con FHIR Encounter). Nota estructurada
 * SOAP. Al FIRMAR se congela: una nota firmada NUNCA se edita destructivamente
 * (§33 #6). El borrado es lógico sólo en borrador; tras firmar se conserva el
 * snapshot + hash de integridad y se registra provenance (§NIVEL 3, ADR-0003 §5).
 */
export const encounterType = pgEnum('encounter_type', [
  'medicina-general',
  'seguimiento',
  'urgencia',
  'teleconsulta',
]);
export const encounterStatus = pgEnum('encounter_status', [
  'in-progress',
  'signed',
  'amended',
  'cancelled',
]);

export const encounter = pgTable(
  'encounter',
  {
    id: text('id').primaryKey().$type<EncounterId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),
    practitionerId: text('practitioner_id').$type<PractitionerId>(),

    type: encounterType('type').notNull().default('medicina-general'),
    status: encounterStatus('status').notNull().default('in-progress'),
    /** Motivo de consulta. */
    reason: text('reason'),

    /** Nota SOAP estructurada (columnas, no JSON blob). */
    subjective: text('subjective'),
    objective: text('objective'),
    assessment: text('assessment'),
    plan: text('plan'),

    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    signedBy: text('signed_by').$type<UserId>(),
    /** Hash de integridad del contenido firmado (SHA-256). */
    signedHash: text('signed_hash'),
    /** Snapshot inmutable del contenido al momento de firmar. */
    signedSnapshot: jsonb('signed_snapshot').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('encounter_tenant_idx').on(t.tenantId),
    index('encounter_tenant_patient_idx').on(t.tenantId, t.patientId),
  ],
);

/**
 * Prescripción / solicitud de medicamento (§NIVEL 8, FHIR MedicationRequest).
 * Estructurada (fármaco, dosis, vía, frecuencia, duración), tenant- y
 * patient-scoped, baja lógica. La SEGURIDAD (alergias, duplicidad) se evalúa con
 * un ruleset versionado antes de crear (`prescription-safety.ts`, §33 #8).
 */
export const medicationRoute = pgEnum('medication_route', [
  'oral',
  'iv',
  'im',
  'sc',
  'topical',
  'inhaled',
  'other',
]);
export const medicationStatus = pgEnum('medication_status', [
  'active',
  'completed',
  'stopped',
  'cancelled',
]);

export const medicationRequest = pgTable(
  'medication_request',
  {
    id: text('id').primaryKey().$type<MedicationRequestId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),
    /** Encuentro que originó la receta, si aplica. */
    encounterId: text('encounter_id').$type<EncounterId>(),

    drug: text('drug').notNull(),
    dose: text('dose'),
    route: medicationRoute('route').notNull().default('oral'),
    frequency: text('frequency'),
    durationDays: text('duration_days'),
    instructions: text('instructions'),
    status: medicationStatus('status').notNull().default('active'),

    prescribedBy: text('prescribed_by').$type<UserId>(),
    prescribedAt: timestamp('prescribed_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('medication_request_tenant_idx').on(t.tenantId),
    index('medication_request_tenant_patient_idx').on(t.tenantId, t.patientId),
  ],
);

/**
 * Orden de estudio / solicitud (§NIVEL 9, FHIR ServiceRequest): laboratorio,
 * imagen o procedimiento. Parte del closed-loop: toda orden debe resolverse con
 * un resultado y su revisión (obligación clínica, §NIVEL 9).
 */
export const serviceRequestCategory = pgEnum('service_request_category', [
  'laboratory',
  'imaging',
  'procedure',
]);
export const serviceRequestPriority = pgEnum('service_request_priority', ['routine', 'urgent']);
export const serviceRequestStatus = pgEnum('service_request_status', [
  'requested',
  'in-progress',
  'completed',
  'cancelled',
]);

export const serviceRequest = pgTable(
  'service_request',
  {
    id: text('id').primaryKey().$type<ServiceRequestId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),
    encounterId: text('encounter_id').$type<EncounterId>(),

    category: serviceRequestCategory('category').notNull().default('laboratory'),
    /** Estudio solicitado, p.ej. "Biometría hemática". */
    code: text('code').notNull(),
    priority: serviceRequestPriority('priority').notNull().default('routine'),
    status: serviceRequestStatus('status').notNull().default('requested'),
    note: text('note'),

    requestedBy: text('requested_by').$type<UserId>(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('service_request_tenant_idx').on(t.tenantId),
    index('service_request_tenant_patient_idx').on(t.tenantId, t.patientId),
  ],
);

/**
 * Resultado de estudio (§NIVEL 9, FHIR DiagnosticReport) + ciclo de revisión
 * CERRADO: un resultado final genera una obligación de revisión que no se cierra
 * hasta marcar revisado + acción + paciente informado (§NIVEL 9, §27). Los
 * resultados críticos no se esconden tras badges ambiguos.
 */
export const reportAbnormalFlag = pgEnum('report_abnormal_flag', [
  'normal',
  'low',
  'high',
  'critical',
]);
export const reportStatus = pgEnum('report_status', ['preliminary', 'final']);
export const reportReviewStatus = pgEnum('report_review_status', ['pending', 'reviewed']);

export const diagnosticReport = pgTable(
  'diagnostic_report',
  {
    id: text('id').primaryKey().$type<DiagnosticReportId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),
    /** Orden que originó este resultado. */
    serviceRequestId: text('service_request_id').$type<ServiceRequestId>(),

    code: text('code').notNull(),
    status: reportStatus('status').notNull().default('final'),
    /** Valor/resumen del resultado, p.ej. "Hb 9.1 g/dL". */
    value: text('value').notNull(),
    /** Unidad del valor numérico, p.ej. "g/dL" (resultado estructurado, §NIVEL 9). */
    unit: text('unit'),
    /** Límites del rango de referencia (texto para tolerar decimales/comas). */
    referenceLow: text('reference_low'),
    referenceHigh: text('reference_high'),
    abnormalFlag: reportAbnormalFlag('abnormal_flag').notNull().default('normal'),
    resultedAt: timestamp('resulted_at', { withTimezone: true }).notNull().defaultNow(),

    /** Ciclo de revisión (closed-loop). */
    reviewStatus: reportReviewStatus('review_status').notNull().default('pending'),
    reviewedBy: text('reviewed_by').$type<UserId>(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewAction: text('review_action'),
    patientInformed: boolean('patient_informed').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('diagnostic_report_tenant_idx').on(t.tenantId),
    index('diagnostic_report_tenant_patient_idx').on(t.tenantId, t.patientId),
    // Result Inbox: resultados finales pendientes de revisión por tenant.
    index('diagnostic_report_review_idx').on(t.tenantId, t.reviewStatus),
  ],
);

/**
 * Exploración física estructurada por aparatos y sistemas (§NIVEL 6, §28 paso 6).
 * Una fila por (encuentro, sección). De estas filas se deriva el "Objetivo" de la
 * nota SOAP, de modo que la firma + hash del encuentro cubren la exploración.
 */
export const encounterExamFinding = pgTable(
  'encounter_exam_finding',
  {
    id: text('id').primaryKey().$type<ExamFindingId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),
    encounterId: text('encounter_id').notNull().$type<EncounterId>(),
    /** Aparato/sistema (catálogo versionado en physical-exam.ts). */
    section: text('section').notNull(),
    /** true = sin alteraciones; false = hallazgos (ver `note`). */
    normal: boolean('normal').notNull().default(true),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('exam_finding_tenant_idx').on(t.tenantId),
    uniqueIndex('exam_finding_encounter_section_idx').on(t.tenantId, t.encounterId, t.section),
  ],
);

/**
 * Diagnósticos del encuentro (§NIVEL 6, §28 paso 7). Liga problemas (Condition)
 * ya existentes del paciente a un encuentro concreto: son los diagnósticos
 * ABORDADOS hoy. De estas filas se deriva el "Análisis (A)" de la nota SOAP, de
 * modo que la firma + hash del encuentro los cubren. Baja física al desmarcar
 * (relación de pertenencia, no PHI destructiva: el Condition persiste aparte).
 */
export const encounterDiagnosis = pgTable(
  'encounter_diagnosis',
  {
    id: text('id').primaryKey().$type<EncounterDiagnosisId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),
    encounterId: text('encounter_id').notNull().$type<EncounterId>(),
    conditionId: text('condition_id').notNull().$type<ConditionId>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('encounter_diagnosis_tenant_idx').on(t.tenantId),
    uniqueIndex('encounter_diagnosis_unique_idx').on(t.tenantId, t.encounterId, t.conditionId),
  ],
);

/**
 * Enmiendas/addenda a un encuentro FIRMADO (§NIVEL 6, §33 #6). La nota firmada es
 * INMUTABLE; una corrección o aclaración se AÑADE como addendum fechado y
 * atribuido, nunca editando el original. Append-only: sin update ni delete.
 */
export const encounterAddendum = pgTable(
  'encounter_addendum',
  {
    id: text('id').primaryKey().$type<EncounterAddendumId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),
    encounterId: text('encounter_id').notNull().$type<EncounterId>(),
    text: text('text').notNull(),
    authorId: text('author_id').notNull().$type<UserId>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('encounter_addendum_tenant_idx').on(t.tenantId),
    index('encounter_addendum_encounter_idx').on(t.tenantId, t.encounterId),
  ],
);

/**
 * Consentimientos del paciente (§NIVEL 3 governance, §26 LFPDPPP/NOM-024). Registra
 * aviso de privacidad, consentimiento de atención, transferencia de datos y
 * consentimiento informado de procedimiento. Trazable: quién otorgó/revocó y cuándo.
 * Append-lógico: revocar NO borra, marca `revoked` con fecha (histórico verificable).
 */
export const consentType = pgEnum('consent_type', [
  'privacy-notice',
  'treatment',
  'data-sharing',
  'informed-procedure',
]);
export const consentStatus = pgEnum('consent_status', ['active', 'revoked']);

export const consent = pgTable(
  'consent',
  {
    id: text('id').primaryKey().$type<ConsentId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),
    type: consentType('type').notNull(),
    status: consentStatus('status').notNull().default('active'),
    /** Versión del documento/política consentida (gobernanza de contenido). */
    policyVersion: text('policy_version'),
    note: text('note'),
    grantedBy: text('granted_by').$type<UserId>(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedBy: text('revoked_by').$type<UserId>(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('consent_tenant_idx').on(t.tenantId),
    index('consent_tenant_patient_idx').on(t.tenantId, t.patientId),
  ],
);
