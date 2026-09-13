import { pgTable, pgEnum, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import type { AuditEventId, PatientId, ProvenanceId, TenantId, UserId } from '@medical-os/shared';

/**
 * Audit / Provenance skeleton (§NIVEL 2 gate, §19, ADR-0003).
 *
 * Dos registros distintos y complementarios:
 * - `audit_event`: QUIÉN hizo QUÉ, CUÁNDO y con qué DECISIÓN de autorización.
 *   Es el rastro de seguridad/cumplimiento, append-only. Incluye el
 *   `authorizationDecisionId` exigido por ADR-0002 para operaciones sensibles.
 * - `provenance`: el ORIGEN clínico de un dato (qué encuentro/firma lo produjo).
 *   Se consolidará en NIVEL 3+; aquí queda el esqueleto mínimo.
 *
 * Invariantes:
 * - Append-only: sin update/delete a nivel de dominio (solo inserciones).
 * - `payload` NUNCA contiene PHI en claro (§NIVEL 10, §33); solo referencias (IDs).
 */

export const auditAction = pgEnum('audit_action', [
  'create',
  'read',
  'update',
  'delete',
  'sign',
  'access_denied',
  'cross_tenant_denied',
]);

export const auditOutcome = pgEnum('audit_outcome', ['allowed', 'denied']);

export const auditEvent = pgTable(
  'audit_event',
  {
    id: text('id').primaryKey().$type<AuditEventId>(),
    /** Tenant del recurso tocado. Nullable solo para eventos de plataforma. */
    tenantId: text('tenant_id').$type<TenantId>(),
    /** Actor autenticado; null si la acción fue anónima/sistema. */
    actorUserId: text('actor_user_id').$type<UserId>(),
    action: auditAction('action').notNull(),
    outcome: auditOutcome('outcome').notNull(),
    /** Tipo de recurso afectado, p.ej. 'patient', 'encounter'. */
    resourceType: text('resource_type').notNull(),
    /** ID del recurso afectado (ULID). */
    resourceId: text('resource_id'),
    /** Paciente relacionado, para el audit trail centrado en el expediente. */
    patientId: text('patient_id').$type<PatientId>(),
    /** ID de la decisión de autorización correlacionada (ADR-0002 §NIVEL 2). */
    authorizationDecisionId: text('authorization_decision_id'),
    /** Metadatos sin PHI (IP, motivo de denegación, etc.). */
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_event_tenant_idx').on(t.tenantId, t.occurredAt),
    index('audit_event_resource_idx').on(t.resourceType, t.resourceId),
    index('audit_event_patient_idx').on(t.tenantId, t.patientId),
    index('audit_event_actor_idx').on(t.actorUserId),
  ],
);

export const provenance = pgTable(
  'provenance',
  {
    id: text('id').primaryKey().$type<ProvenanceId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    /** Recurso clínico cuya procedencia se registra. */
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    /** Actividad que lo originó, p.ej. 'encounter-sign', 'lab-result-import'. */
    activity: text('activity').notNull(),
    /** Agente responsable (practitioner/user/system). */
    agentId: text('agent_id'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('provenance_tenant_idx').on(t.tenantId),
    index('provenance_target_idx').on(t.targetType, t.targetId),
  ],
);
