import { and, eq, isNull, desc } from 'drizzle-orm';
import {
  newServiceRequestId,
  newDiagnosticReportId,
  type ServiceRequestId,
  type DiagnosticReportId,
  type EncounterId,
  type PatientId,
  type TenantId,
} from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { serviceRequest, diagnosticReport, patient } from '../schema';

export type ServiceRequestRow = (typeof serviceRequest)['$inferSelect'];
export type DiagnosticReportRow = (typeof diagnosticReport)['$inferSelect'];

export type ServiceCategory = 'laboratory' | 'imaging' | 'procedure';
export type AbnormalFlag = 'normal' | 'low' | 'high' | 'critical';

async function patientInTenant(
  db: Database,
  tenantId: TenantId,
  patientId: PatientId,
): Promise<boolean> {
  const [row] = await db
    .select({ id: patient.id })
    .from(patient)
    .where(
      and(eq(patient.id, patientId), eq(patient.tenantId, tenantId), isNull(patient.deletedAt)),
    )
    .limit(1);
  return Boolean(row);
}

/** Órdenes de estudio (§NIVEL 9). Tenant- y patient-scoped, baja lógica. */
export class ServiceRequestRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  async listForPatient(patientId: PatientId): Promise<ServiceRequestRow[]> {
    const rows = await this.db
      .select()
      .from(serviceRequest)
      .where(
        and(
          eq(serviceRequest.tenantId, this.ctx.tenantId),
          eq(serviceRequest.patientId, patientId),
          isNull(serviceRequest.deletedAt),
        ),
      )
      .orderBy(desc(serviceRequest.requestedAt));
    return rows as ServiceRequestRow[];
  }

  async getById(id: ServiceRequestId): Promise<ServiceRequestRow | null> {
    const [row] = await this.db
      .select()
      .from(serviceRequest)
      .where(and(eq(serviceRequest.id, id), eq(serviceRequest.tenantId, this.ctx.tenantId)))
      .limit(1);
    return (row as ServiceRequestRow) ?? null;
  }

  async create(input: {
    patientId: PatientId;
    code: string;
    category?: ServiceCategory;
    priority?: 'routine' | 'urgent';
    encounterId?: EncounterId;
    note?: string;
  }): Promise<ServiceRequestRow | null> {
    if (!(await patientInTenant(this.db, this.ctx.tenantId, input.patientId))) return null;
    const [created] = await this.db
      .insert(serviceRequest)
      .values({
        id: newServiceRequestId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        code: input.code,
        category: input.category ?? 'laboratory',
        priority: input.priority ?? 'routine',
        encounterId: input.encounterId ?? null,
        note: input.note ?? null,
        requestedBy: this.ctx.userId,
      })
      .returning();
    return created as ServiceRequestRow;
  }

  async setStatus(
    id: ServiceRequestId,
    status: 'requested' | 'in-progress' | 'completed' | 'cancelled',
  ): Promise<boolean> {
    const [updated] = await this.db
      .update(serviceRequest)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(serviceRequest.id, id), eq(serviceRequest.tenantId, this.ctx.tenantId)))
      .returning({ id: serviceRequest.id });
    return Boolean(updated);
  }
}

/**
 * Resultados (§NIVEL 9) + ciclo de revisión cerrado. Ingresar un resultado pone
 * la orden `completed`; el resultado final queda pendiente de revisión hasta
 * `markReviewed` (acción + paciente informado), que cierra la obligación.
 */
export class DiagnosticReportRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  async listForPatient(patientId: PatientId): Promise<DiagnosticReportRow[]> {
    const rows = await this.db
      .select()
      .from(diagnosticReport)
      .where(
        and(
          eq(diagnosticReport.tenantId, this.ctx.tenantId),
          eq(diagnosticReport.patientId, patientId),
          isNull(diagnosticReport.deletedAt),
        ),
      )
      .orderBy(desc(diagnosticReport.resultedAt));
    return rows as DiagnosticReportRow[];
  }

  /** Result Inbox: resultados finales pendientes de revisión (todo el tenant). */
  async listPendingReview(limit = 100): Promise<DiagnosticReportRow[]> {
    const rows = await this.db
      .select()
      .from(diagnosticReport)
      .where(
        and(
          eq(diagnosticReport.tenantId, this.ctx.tenantId),
          eq(diagnosticReport.status, 'final'),
          eq(diagnosticReport.reviewStatus, 'pending'),
          isNull(diagnosticReport.deletedAt),
        ),
      )
      .orderBy(desc(diagnosticReport.resultedAt))
      .limit(limit);
    return rows as DiagnosticReportRow[];
  }

  async getById(id: DiagnosticReportId): Promise<DiagnosticReportRow | null> {
    const [row] = await this.db
      .select()
      .from(diagnosticReport)
      .where(and(eq(diagnosticReport.id, id), eq(diagnosticReport.tenantId, this.ctx.tenantId)))
      .limit(1);
    return (row as DiagnosticReportRow) ?? null;
  }

  /** Ingresa un resultado y marca la orden vinculada como completada. */
  async enterResult(input: {
    patientId: PatientId;
    code: string;
    value: string;
    abnormalFlag?: AbnormalFlag;
    serviceRequestId?: ServiceRequestId;
  }): Promise<DiagnosticReportRow | null> {
    if (!(await patientInTenant(this.db, this.ctx.tenantId, input.patientId))) return null;
    const [created] = await this.db
      .insert(diagnosticReport)
      .values({
        id: newDiagnosticReportId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId,
        serviceRequestId: input.serviceRequestId ?? null,
        code: input.code,
        value: input.value,
        abnormalFlag: input.abnormalFlag ?? 'normal',
      })
      .returning();

    if (input.serviceRequestId) {
      await this.db
        .update(serviceRequest)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(
          and(
            eq(serviceRequest.id, input.serviceRequestId),
            eq(serviceRequest.tenantId, this.ctx.tenantId),
          ),
        );
    }
    return created as DiagnosticReportRow;
  }

  /**
   * Cierra la obligación clínica: marca revisado con acción y si el paciente fue
   * informado. Devuelve null si no es del tenant o ya estaba revisado.
   */
  async markReviewed(
    id: DiagnosticReportId,
    input: { action: string; patientInformed: boolean },
  ): Promise<DiagnosticReportRow | null> {
    const [updated] = await this.db
      .update(diagnosticReport)
      .set({
        reviewStatus: 'reviewed',
        reviewedBy: this.ctx.userId,
        reviewedAt: new Date(),
        reviewAction: input.action,
        patientInformed: input.patientInformed,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(diagnosticReport.id, id),
          eq(diagnosticReport.tenantId, this.ctx.tenantId),
          eq(diagnosticReport.reviewStatus, 'pending'),
          isNull(diagnosticReport.deletedAt),
        ),
      )
      .returning();
    return (updated as DiagnosticReportRow) ?? null;
  }
}
