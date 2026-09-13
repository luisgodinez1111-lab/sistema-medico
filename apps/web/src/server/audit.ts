import 'server-only';
import { AuditRepository, decide, type TenantContext } from '@medical-os/db';
import { getDb } from './db';

type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'sign';

/**
 * Autoriza una operación sensible Y la audita en un solo paso (§NIVEL 2 gate,
 * ADR-0002): evalúa el permiso con `decide()`, escribe un `audit_event` con el
 * `authorization_decision_id` y el resultado (allowed/denied), y devuelve si
 * procede. La autorización es server-side; el front nunca decide.
 */
export async function auditedAuthorize(
  ctx: TenantContext,
  permission: string,
  meta: {
    action: AuditAction;
    resourceType: string;
    resourceId?: string;
    patientId?: string;
  },
): Promise<boolean> {
  const decision = decide(ctx, permission);
  await new AuditRepository(getDb(), ctx).record({
    action: decision.allowed ? meta.action : 'access_denied',
    outcome: decision.allowed ? 'allowed' : 'denied',
    resourceType: meta.resourceType,
    ...(meta.resourceId ? { resourceId: meta.resourceId } : {}),
    ...(meta.patientId ? { patientId: meta.patientId } : {}),
    decision,
    payload: { permission },
  });
  return decision.allowed;
}
