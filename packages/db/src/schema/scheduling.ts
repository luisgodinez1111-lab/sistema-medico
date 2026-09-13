import { pgTable, pgEnum, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import type {
  AppointmentId,
  FacilityId,
  PatientId,
  PractitionerId,
  TenantId,
  UserId,
} from '@medical-os/shared';

/**
 * Agenda / citas (Release R3, FHIR Appointment). Operacional — SEPARADA de las
 * tablas clínicas nucleares (§33 #11: no mezclar pagos/operaciones con lo
 * clínico). Tenant- y patient-scoped, baja lógica.
 *
 * El check-in es la transición `booked → arrived`.
 */
export const appointmentStatus = pgEnum('appointment_status', [
  'booked',
  'arrived',
  'fulfilled',
  'cancelled',
  'no-show',
]);

export const appointment = pgTable(
  'appointment',
  {
    id: text('id').primaryKey().$type<AppointmentId>(),
    tenantId: text('tenant_id').notNull().$type<TenantId>(),
    patientId: text('patient_id').notNull().$type<PatientId>(),
    practitionerId: text('practitioner_id').$type<PractitionerId>(),
    facilityId: text('facility_id').$type<FacilityId>(),

    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(30),
    status: appointmentStatus('status').notNull().default('booked'),
    reason: text('reason'),
    note: text('note'),
    /** Momento del check-in (llegada del paciente). */
    arrivedAt: timestamp('arrived_at', { withTimezone: true }),

    createdBy: text('created_by').$type<UserId>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('appointment_tenant_start_idx').on(t.tenantId, t.startAt),
    index('appointment_tenant_patient_idx').on(t.tenantId, t.patientId),
  ],
);
