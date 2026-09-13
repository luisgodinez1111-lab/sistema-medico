import { and, eq, isNull, desc, inArray } from 'drizzle-orm';
import { newConditionId, type ConditionId, type PatientId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { condition, patient } from '../schema';

export type ConditionRow = (typeof condition)['$inferSelect'];

export type ConditionClinicalStatus =
  'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';

export interface NewConditionInput {
  patientId: PatientId;
  code: string;
  codeSystem?: string;
  onsetDate?: string;
  note?: string;
}

/** Estados que cuentan como "problema activo". */
const ACTIVE_STATUSES: ConditionClinicalStatus[] = ['active', 'recurrence', 'relapse'];

/**
 * Repositorio tenant-aware de problemas/diagnósticos (§NIVEL 3, ADR-0002/0003).
 * Mismo contrato que AllergyRepository: scoping por tenant, validación de que
 * el paciente sea del tenant, baja lógica.
 */
export class ConditionRepository {
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

  /** Problemas activos del paciente, más recientes primero. */
  async listActive(patientId: PatientId): Promise<ConditionRow[]> {
    const rows = await this.db
      .select()
      .from(condition)
      .where(
        and(
          eq(condition.tenantId, this.ctx.tenantId),
          eq(condition.patientId, patientId),
          isNull(condition.deletedAt),
          inArray(condition.clinicalStatus, ACTIVE_STATUSES),
        ),
      )
      .orderBy(desc(condition.recordedAt));
    return rows as ConditionRow[];
  }

  /** Todos los problemas (incluye inactivos/resueltos), para historial. */
  async listAll(patientId: PatientId): Promise<ConditionRow[]> {
    const rows = await this.db
      .select()
      .from(condition)
      .where(
        and(
          eq(condition.tenantId, this.ctx.tenantId),
          eq(condition.patientId, patientId),
          isNull(condition.deletedAt),
        ),
      )
      .orderBy(desc(condition.recordedAt));
    return rows as ConditionRow[];
  }

  /** Registra un problema. Devuelve null si el paciente no es del tenant. */
  async create(input: NewConditionInput): Promise<ConditionRow | null> {
    if (!(await this.assertPatientInTenant(input.patientId))) return null;
    const [created] = await this.db
      .insert(condition)
      .values({
        id: newConditionId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        code: input.code,
        codeSystem: input.codeSystem ?? null,
        onsetDate: input.onsetDate ?? null,
        note: input.note ?? null,
        recordedBy: this.ctx.userId,
      })
      .returning();
    return created as ConditionRow;
  }

  /** Cambia el estado clínico (p.ej. marcar 'resolved'). Scoped al tenant. */
  async setStatus(id: ConditionId, status: ConditionClinicalStatus): Promise<boolean> {
    const [updated] = await this.db
      .update(condition)
      .set({ clinicalStatus: status, updatedAt: new Date() })
      .where(
        and(
          eq(condition.id, id),
          eq(condition.tenantId, this.ctx.tenantId),
          isNull(condition.deletedAt),
        ),
      )
      .returning({ id: condition.id });
    return Boolean(updated);
  }

  /** Baja lógica. Devuelve false si no es del tenant. */
  async softDelete(id: ConditionId): Promise<boolean> {
    const [updated] = await this.db
      .update(condition)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(condition.id, id),
          eq(condition.tenantId, this.ctx.tenantId),
          isNull(condition.deletedAt),
        ),
      )
      .returning({ id: condition.id });
    return Boolean(updated);
  }
}
