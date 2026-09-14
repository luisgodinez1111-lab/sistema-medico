import { and, eq, desc, isNull } from 'drizzle-orm';
import {
  newProcedureId,
  type ProcedureId,
  type PatientId,
  type EncounterId,
  type ServiceRequestId,
  type PractitionerId,
} from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { procedure, patient } from '../schema';

export type ProcedureRow = (typeof procedure)['$inferSelect'];
export type ProcedureStatus = 'in-progress' | 'completed' | 'not-done' | 'entered-in-error';

export interface NewProcedureInput {
  patientId: PatientId;
  code: string;
  status?: ProcedureStatus;
  encounterId?: EncounterId;
  serviceRequestId?: ServiceRequestId;
  performedDate?: string;
  performerId?: PractitionerId;
  outcome?: string;
  note?: string;
}

/**
 * Procedimientos REALIZADOS (§NIVEL 3, FHIR Procedure). Distinto de la orden
 * (`service_request`): registra el acto ejecutado, con autor y fecha. Tenant- y
 * patient-scoped. Borrado LÓGICO (ADR-0003), nunca destructivo.
 */
export class ProcedureRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  private async patientInTenant(patientId: PatientId): Promise<boolean> {
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

  /** Procedimientos del paciente (recientes primero); excluye borrados lógicos. */
  async listForPatient(patientId: PatientId): Promise<ProcedureRow[]> {
    const rows = await this.db
      .select()
      .from(procedure)
      .where(
        and(
          eq(procedure.tenantId, this.ctx.tenantId),
          eq(procedure.patientId, patientId),
          isNull(procedure.deletedAt),
        ),
      )
      .orderBy(desc(procedure.performedDate), desc(procedure.createdAt));
    return rows as ProcedureRow[];
  }

  /** Registra un procedimiento realizado. Valida que el paciente sea del tenant. */
  async create(input: NewProcedureInput): Promise<ProcedureRow | null> {
    if (!(await this.patientInTenant(input.patientId))) return null;
    const [created] = await this.db
      .insert(procedure)
      .values({
        id: newProcedureId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        code: input.code,
        status: input.status ?? 'completed',
        encounterId: input.encounterId ?? null,
        serviceRequestId: input.serviceRequestId ?? null,
        performedDate: input.performedDate ?? null,
        performerId: input.performerId ?? null,
        outcome: input.outcome ?? null,
        note: input.note ?? null,
        performedBy: this.ctx.userId,
      })
      .returning();
    return created as ProcedureRow;
  }

  /** Baja lógica de un procedimiento (nunca destructivo; ADR-0003). */
  async softDelete(id: ProcedureId): Promise<boolean> {
    const [updated] = await this.db
      .update(procedure)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(procedure.id, id),
          eq(procedure.tenantId, this.ctx.tenantId),
          isNull(procedure.deletedAt),
        ),
      )
      .returning({ id: procedure.id });
    return Boolean(updated);
  }
}
