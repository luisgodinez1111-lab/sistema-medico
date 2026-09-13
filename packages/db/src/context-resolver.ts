import { and, eq } from 'drizzle-orm';
import { asId, type TenantId, type UserId } from '@medical-os/shared';
import type { Database } from './client';
import { createTenantContext, type TenantContext } from './tenant-context';
import { tenant, appUser, membership, membershipRole, rolePermission } from './schema';

/**
 * Resuelve el TenantContext EN EL SERVIDOR a partir de identificadores estables
 * (slug de tenant + email de usuario), cargando los permisos efectivos desde la
 * BD (membership → membership_role → role_permission).
 *
 * Es la pieza que hoy sustituye al IdP real (NIVEL 2 auth, pendiente): el tenant
 * y el usuario se determinan server-side y NUNCA a partir de input del cliente.
 * Devuelve null si no hay membresía activa (sin acceso).
 */
export async function resolveTenantContext(
  db: Database,
  params: { tenantSlug: string; userEmail: string },
): Promise<TenantContext | null> {
  const [t] = await db
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.slug, params.tenantSlug))
    .limit(1);
  if (!t) return null;
  const tenantId = asId<TenantId>(t.id);

  const [u] = await db
    .select({ id: appUser.id, status: appUser.status })
    .from(appUser)
    .where(eq(appUser.email, params.userEmail))
    .limit(1);
  if (!u || u.status !== 'active') return null;
  const userId = asId<UserId>(u.id);

  return buildContextForMembership(db, tenantId, userId);
}

/**
 * Resuelve el TenantContext a partir del USUARIO AUTENTICADO (por id, tras la
 * verificación del IdP). Es la vía real de NIVEL 2: el userId proviene del JWT
 * verificado en servidor, nunca del cliente.
 *
 * - Con `tenantId`: exige membresía activa en ESE tenant (para tenant switcher).
 * - Sin `tenantId`: usa la única membresía activa del usuario; si tiene varias,
 *   devuelve null (requiere elegir tenant explícitamente — sin adivinar).
 */
export async function resolveTenantContextForUser(
  db: Database,
  params: { userId: string; tenantId?: string },
): Promise<TenantContext | null> {
  const userId = asId<UserId>(params.userId);

  const memberships = await db
    .select({ id: membership.id, tenantId: membership.tenantId, status: membership.status })
    .from(membership)
    .where(eq(membership.userId, userId));

  const active = memberships.filter((m) => m.status === 'active');
  let chosen: (typeof active)[number] | undefined;
  if (params.tenantId) {
    chosen = active.find((m) => m.tenantId === params.tenantId);
  } else if (active.length === 1) {
    chosen = active[0];
  }
  if (!chosen) return null;

  return buildContextForMembership(db, asId<TenantId>(chosen.tenantId), userId);
}

/** Carga permisos efectivos de una membresía activa y arma el contexto. */
async function buildContextForMembership(
  db: Database,
  tenantId: TenantId,
  userId: UserId,
): Promise<TenantContext | null> {
  const [mem] = await db
    .select({ id: membership.id, status: membership.status })
    .from(membership)
    .where(and(eq(membership.tenantId, tenantId), eq(membership.userId, userId)))
    .limit(1);
  if (!mem || mem.status !== 'active') return null;

  // Permisos efectivos: roles de la membresía × permisos del rol.
  const rows = await db
    .select({ permissionKey: rolePermission.permissionKey })
    .from(membershipRole)
    .innerJoin(
      rolePermission,
      and(
        eq(rolePermission.tenantId, membershipRole.tenantId),
        eq(rolePermission.roleId, membershipRole.roleId),
      ),
    )
    .where(and(eq(membershipRole.tenantId, tenantId), eq(membershipRole.membershipId, mem.id)));

  return createTenantContext({
    tenantId,
    userId,
    permissions: rows.map((r) => r.permissionKey),
  });
}
