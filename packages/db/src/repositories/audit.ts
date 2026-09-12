import { and, desc, eq } from 'drizzle-orm';
import { newAuditEventId } from '@medical-os/shared';
import type { Database } from '../client';
import type { TenantContext, AuthorizationDecision } from '../tenant-context';
import { auditEvent } from '../schema';

/** Fila de auditoría tal como se lee (tipos branded vía alias exportados). */
export type AuditEventRow = (typeof auditEvent)['$inferSelect'];

type AuditAction =
  'create' | 'read' | 'update' | 'delete' | 'sign' | 'access_denied' | 'cross_tenant_denied';

/**
 * Registro de auditoría append-only (§NIVEL 2 gate, §19).
 * Solo inserta; no expone update ni delete a nivel de dominio.
 * El `payload` nunca lleva PHI en claro (§NIVEL 10, §33).
 */
export class AuditRepository {
  constructor(
    private readonly db: Database,
    private readonly ctx: TenantContext,
  ) {}

  async record(input: {
    action: AuditAction;
    outcome: 'allowed' | 'denied';
    resourceType: string;
    resourceId?: string;
    decision?: AuthorizationDecision;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(auditEvent).values({
      id: newAuditEventId(),
      tenantId: this.ctx.tenantId,
      actorUserId: this.ctx.userId,
      action: input.action,
      outcome: input.outcome,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      authorizationDecisionId: input.decision?.id ?? null,
      payload: input.payload ?? null,
    });
  }

  /** Atajo para el evento de seguridad crítico de acceso cruzado (ADR-0002 §6). */
  async recordCrossTenantDenied(resourceType: string, resourceId: string): Promise<void> {
    await this.record({
      action: 'cross_tenant_denied',
      outcome: 'denied',
      resourceType,
      resourceId,
      payload: { reason: 'cross_tenant_access_blocked' },
    });
  }

  /** Lee los eventos del tenant del contexto (scoping obligatorio). */
  async listRecent(limit = 50): Promise<AuditEventRow[]> {
    return this.db
      .select()
      .from(auditEvent)
      .where(eq(auditEvent.tenantId, this.ctx.tenantId))
      .orderBy(desc(auditEvent.occurredAt))
      .limit(limit);
  }

  async listByResource(resourceType: string, resourceId: string): Promise<AuditEventRow[]> {
    return this.db
      .select()
      .from(auditEvent)
      .where(
        and(
          eq(auditEvent.tenantId, this.ctx.tenantId),
          eq(auditEvent.resourceType, resourceType),
          eq(auditEvent.resourceId, resourceId),
        ),
      )
      .orderBy(desc(auditEvent.occurredAt));
  }
}
