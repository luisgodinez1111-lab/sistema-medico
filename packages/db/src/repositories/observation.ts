import { and, eq, isNull, desc } from 'drizzle-orm';
import { newObservationId, type ObservationId, type PatientId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { observation, patient } from '../schema';

export type ObservationRow = (typeof observation)['$inferSelect'];

export type ObservationCategory = 'vital-signs' | 'laboratory' | 'exam' | 'other';

export interface NewObservationInput {
  patientId: PatientId;
  code: string;
  valueText: string;
  unit?: string;
  category?: ObservationCategory;
  note?: string;
  effectiveAt?: Date;
}

/**
 * Repositorio tenant-aware de observaciones/signos vitales (§NIVEL 3).
 * Mismo contrato de scoping y validación patient-in-tenant que los demás.
 */
export class ObservationRepository {
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

  /** Observaciones del paciente (por categoría), medición más reciente primero. */
  async listForPatient(
    patientId: PatientId,
    category: ObservationCategory = 'vital-signs',
    limit = 50,
  ): Promise<ObservationRow[]> {
    const rows = await this.db
      .select()
      .from(observation)
      .where(
        and(
          eq(observation.tenantId, this.ctx.tenantId),
          eq(observation.patientId, patientId),
          eq(observation.category, category),
          isNull(observation.deletedAt),
        ),
      )
      .orderBy(desc(observation.effectiveAt))
      .limit(limit);
    return rows as ObservationRow[];
  }

  /** Registra una observación. Devuelve null si el paciente no es del tenant. */
  async create(input: NewObservationInput): Promise<ObservationRow | null> {
    if (!(await this.assertPatientInTenant(input.patientId))) return null;
    const [created] = await this.db
      .insert(observation)
      .values({
        id: newObservationId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        category: input.category ?? 'vital-signs',
        code: input.code,
        valueText: input.valueText,
        unit: input.unit ?? null,
        note: input.note ?? null,
        ...(input.effectiveAt ? { effectiveAt: input.effectiveAt } : {}),
        recordedBy: this.ctx.userId,
      })
      .returning();
    return created as ObservationRow;
  }

  /** Baja lógica. Devuelve false si no es del tenant. */
  async softDelete(id: ObservationId): Promise<boolean> {
    const [updated] = await this.db
      .update(observation)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(observation.id, id),
          eq(observation.tenantId, this.ctx.tenantId),
          isNull(observation.deletedAt),
        ),
      )
      .returning({ id: observation.id });
    return Boolean(updated);
  }
}
