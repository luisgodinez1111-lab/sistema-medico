import { and, eq, desc, ne, isNull } from 'drizzle-orm';
import {
  newArcoRequestId,
  addBusinessDays,
  type ArcoRequestId,
  type PatientId,
} from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext } from '../tenant-context';
import { arcoRequest, patient } from '../schema';

export type ArcoRow = (typeof arcoRequest)['$inferSelect'];
export type ArcoType = 'access' | 'rectification' | 'cancellation' | 'opposition';
export type ArcoStatus = 'received' | 'in-review' | 'completed' | 'rejected';
export type ArcoOutcome = 'granted' | 'partially-granted' | 'denied';

/** Días hábiles de plazo legal LFPDPPP para responder una solicitud ARCO. */
export const ARCO_RESPONSE_BUSINESS_DAYS = 20;

export interface NewArcoInput {
  patientId?: PatientId;
  type: ArcoType;
  requesterName: string;
  requesterContact?: string;
  requesterRelation?: 'self' | 'representative';
  detail?: string;
}

export interface ResolveArcoInput {
  outcome: ArcoOutcome;
  resolution: string;
  /** 'completed' (atendida) o 'rejected' (improcedente). Default: completed. */
  status?: 'completed' | 'rejected';
}

/**
 * Solicitudes ARCO — derechos del titular (LFPDPPP, §NIVEL 18). Tenant-scoped.
 * Toda solicitud nace con PLAZO legal (`dueDate` = recepción + 20 días hábiles) y
 * se cierra con resolución atribuida y fechada; nunca se borra (§0, cumplimiento).
 */
export class ArcoRepository {
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

  /** Todas las solicitudes del tenant (recientes primero). */
  async list(limit = 100): Promise<ArcoRow[]> {
    const rows = await this.db
      .select()
      .from(arcoRequest)
      .where(eq(arcoRequest.tenantId, this.ctx.tenantId))
      .orderBy(desc(arcoRequest.createdAt))
      .limit(limit);
    return rows as ArcoRow[];
  }

  /** Solicitudes abiertas (recibidas o en revisión), las de plazo vivo primero. */
  async listOpen(limit = 100): Promise<ArcoRow[]> {
    const rows = await this.db
      .select()
      .from(arcoRequest)
      .where(
        and(
          eq(arcoRequest.tenantId, this.ctx.tenantId),
          ne(arcoRequest.status, 'completed'),
          ne(arcoRequest.status, 'rejected'),
        ),
      )
      .orderBy(arcoRequest.dueDate)
      .limit(limit);
    return rows as ArcoRow[];
  }

  async getById(id: ArcoRequestId): Promise<ArcoRow | null> {
    const [row] = await this.db
      .select()
      .from(arcoRequest)
      .where(and(eq(arcoRequest.id, id), eq(arcoRequest.tenantId, this.ctx.tenantId)))
      .limit(1);
    return (row as ArcoRow) ?? null;
  }

  /** Registra una solicitud. Si trae `patientId`, valida que sea del tenant. */
  async create(input: NewArcoInput): Promise<ArcoRow | null> {
    if (input.patientId && !(await this.patientInTenant(input.patientId))) return null;
    const now = new Date();
    const due = addBusinessDays(now, ARCO_RESPONSE_BUSINESS_DAYS);
    const dueDate = due.toISOString().slice(0, 10);
    const [created] = await this.db
      .insert(arcoRequest)
      .values({
        id: newArcoRequestId(),
        tenantId: this.ctx.tenantId,
        patientId: input.patientId ?? null,
        type: input.type,
        requesterName: input.requesterName,
        requesterContact: input.requesterContact ?? null,
        requesterRelation: input.requesterRelation ?? 'self',
        detail: input.detail ?? null,
        receivedAt: now,
        dueDate,
        createdBy: this.ctx.userId,
      })
      .returning();
    return created as ArcoRow;
  }

  /** Marca una solicitud como en revisión (sólo si estaba recibida). */
  async markInReview(id: ArcoRequestId): Promise<boolean> {
    const [updated] = await this.db
      .update(arcoRequest)
      .set({ status: 'in-review', updatedAt: new Date() })
      .where(
        and(
          eq(arcoRequest.id, id),
          eq(arcoRequest.tenantId, this.ctx.tenantId),
          eq(arcoRequest.status, 'received'),
        ),
      )
      .returning({ id: arcoRequest.id });
    return Boolean(updated);
  }

  /** Resuelve la solicitud con desenlace + resolución atribuida y fechada. */
  async resolve(id: ArcoRequestId, input: ResolveArcoInput): Promise<boolean> {
    const [updated] = await this.db
      .update(arcoRequest)
      .set({
        status: input.status ?? 'completed',
        outcome: input.outcome,
        resolution: input.resolution,
        resolvedBy: this.ctx.userId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(arcoRequest.id, id),
          eq(arcoRequest.tenantId, this.ctx.tenantId),
          ne(arcoRequest.status, 'completed'),
          ne(arcoRequest.status, 'rejected'),
        ),
      )
      .returning({ id: arcoRequest.id });
    return Boolean(updated);
  }
}
