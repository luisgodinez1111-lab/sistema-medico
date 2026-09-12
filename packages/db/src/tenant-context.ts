import { newUlid, type TenantId, type UserId } from '@medical-os/shared';

/**
 * Contexto de seguridad resuelto EN EL SERVIDOR a partir del principal
 * autenticado (ADR-0002 §1). Nunca se construye con un `tenant_id` enviado por
 * el cliente: quien lo crea es la capa de sesión/autenticación, no el request.
 *
 * Todos los repositories exigen un `TenantContext` y derivan de él el scoping;
 * no existe forma de consultar datos tenant-scoped sin pasar por aquí.
 */
export interface TenantContext {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  /** Claves de permiso efectivas del principal en este tenant (RBAC). */
  readonly permissions: ReadonlySet<string>;
}

export function createTenantContext(params: {
  tenantId: TenantId;
  userId: UserId;
  permissions?: Iterable<string>;
}): TenantContext {
  return {
    tenantId: params.tenantId,
    userId: params.userId,
    permissions: new Set(params.permissions ?? []),
  };
}

export function hasPermission(ctx: TenantContext, permission: string): boolean {
  return ctx.permissions.has(permission);
}

/**
 * Una decisión de autorización correlacionable. El `id` se persiste en
 * `audit_event.authorization_decision_id` para operaciones sensibles (ADR-0002).
 */
export interface AuthorizationDecision {
  readonly id: string;
  readonly allowed: boolean;
  readonly permission: string;
  readonly reason?: string;
}

/** Evalúa un permiso y produce una decisión auditable (sin lanzar). */
export function decide(ctx: TenantContext, permission: string): AuthorizationDecision {
  const allowed = hasPermission(ctx, permission);
  return {
    id: newUlid(),
    allowed,
    permission,
    ...(allowed ? {} : { reason: 'missing_permission' }),
  };
}
