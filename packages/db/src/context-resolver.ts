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
