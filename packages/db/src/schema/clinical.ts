import {
  pgTable,
  pgEnum,
  text,
  date,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import type {
  AllergyId,
  ConditionId,
  HistoryEntryId,
  ObservationId,
  PatientId,
  RelatedPersonId,
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
