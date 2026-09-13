import { and, eq, isNull, gte, lt, desc, asc } from 'drizzle-orm';
import {
  newAppointmentId,
  type AppointmentId,
  type PatientId,
  type PractitionerId,
  type FacilityId,
} from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { appointment, patient } from '../schema';

export type AppointmentRow = (typeof appointment)['$inferSelect'];
export type AppointmentStatus = 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'no-show';

export interface NewAppointmentInput {
  patientId: PatientId;
  startAt: Date;
  durationMinutes?: number;
  reason?: string;
  practitionerId?: PractitionerId;
  facilityId?: FacilityId;
}

/**
 * Agenda (R3). Tenant- y patient-scoped, baja lógica. El check-in es la
 * transición `booked → arrived`; las citas canceladas/atendidas no se re-checan.
 */
export class AppointmentRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  private async assertPatientInTenant(patientId: PatientId): Promise<boolean> {
    const [row] = await this.db
      .select({ id: patient.id })
      .from(patient)
      .where(
        and(
          eq(patient.id, patientId),
          eq(patient.tenantId, this.ctx.tenantId),
          isNull(patient.deletedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /** Citas de un día [desde, hasta) ordenadas por hora. */
  async listForDay(dayStart: Date, dayEnd: Date): Promise<AppointmentRow[]> {
    const rows = await this.db
      .select()
      .from(appointment)
      .where(
        and(
          eq(appointment.tenantId, this.ctx.tenantId),
          isNull(appointment.deletedAt),
          gte(appointment.startAt, dayStart),
          lt(appointment.startAt, dayEnd),
        ),
      )
      .orderBy(asc(appointment.startAt));
    return rows as AppointmentRow[];
  }

  async listForPatient(patientId: PatientId): Promise<AppointmentRow[]> {
    const rows = await this.db
      .select()
      .from(appointment)
      .where(
        and(
          eq(appointment.tenantId, this.ctx.tenantId),
          eq(appointment.patientId, patientId),
          isNull(appointment.deletedAt),
        ),
      )
      .orderBy(desc(appointment.startAt));
    return rows as AppointmentRow[];
  }

  async create(input: NewAppointmentInput): Promise<AppointmentRow | null> {
    if (!(await this.assertPatientInTenant(input.patientId))) return null;
    const [created] = await this.db
      .insert(appointment)
      .values({
        id: newAppointmentId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        startAt: input.startAt,
        durationMinutes: input.durationMinutes ?? 30,
        reason: input.reason ?? null,
        practitionerId: input.practitionerId ?? null,
        facilityId: input.facilityId ?? null,
        createdBy: this.ctx.userId,
      })
      .returning();
    return created as AppointmentRow;
  }

  /** Check-in: marca llegada (sólo desde `booked`). Devuelve false si no aplica. */
  async checkIn(id: AppointmentId): Promise<boolean> {
    const [updated] = await this.db
      .update(appointment)
      .set({ status: 'arrived', arrivedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(appointment.id, id),
          eq(appointment.tenantId, this.ctx.tenantId),
          eq(appointment.status, 'booked'),
          isNull(appointment.deletedAt),
        ),
      )
      .returning({ id: appointment.id });
    return Boolean(updated);
  }

  /** Cambia el estado (p.ej. cancelar, no-show, atendida). Scoped al tenant. */
  async setStatus(id: AppointmentId, status: AppointmentStatus): Promise<boolean> {
    const [updated] = await this.db
      .update(appointment)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(appointment.id, id),
          eq(appointment.tenantId, this.ctx.tenantId),
          isNull(appointment.deletedAt),
        ),
      )
      .returning({ id: appointment.id });
    return Boolean(updated);
  }
}
