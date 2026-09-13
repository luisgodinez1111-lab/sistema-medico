import { pgTable, pgEnum, text, date, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import type { AllergyId, PatientId, TenantId, UserId } from '@medical-os/shared';

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
