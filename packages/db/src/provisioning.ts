import { and, eq } from 'drizzle-orm';
import {
  newTenantId,
  newOrganizationId,
  newFacilityId,
  newMembershipId,
  newRoleId,
  newPractitionerId,
  asId,
  type TenantId,
  type UserId,
} from '@medical-os/shared';
import {
  ok,
  err,
  ConflictError,
  ValidationError,
  type Result,
  type DomainError,
} from '@medical-os/shared';
import type { Database } from './client';
import {
  tenant,
  organization,
  facility,
  membership,
  role,
  permission,
  rolePermission,
  membershipRole,
  practitioner,
} from './schema';
import { SpecialtyRepository } from './repositories/specialty';
import { createTenantContext } from './tenant-context';

/**
 * Aprovisionamiento de un tenant nuevo (onboarding, §28 paso 1). Crea, en
 * secuencia IDEMPOTENTE (neon-http no soporta transacción multi-statement):
 * tenant → organización → consultorio → membresía admin del usuario → rol admin
 * con permisos → practitioner. Opcionalmente fija la especialidad (R7).
 *
 * El usuario que aprovisiona queda como ADMIN de su propia clínica. No cruza
 * tenants: sólo toca el tenant recién creado y la membresía del `userId` dado.
 */

/** Catálogo base de permisos (mismo que usa el seed). */
export const BASE_PERMISSIONS: ReadonlyArray<{ key: string; description: string }> = [
  { key: 'patient.read', description: 'Ver pacientes' },
  { key: 'patient.write', description: 'Crear/editar pacientes' },
  { key: 'organization.manage', description: 'Administrar organizaciones y consultorios' },
  { key: 'encounter.sign', description: 'Firmar encuentros clínicos' },
  { key: 'privacy.manage', description: 'Gestionar solicitudes ARCO y privacidad (§NIVEL 18)' },
];

export interface ProvisionTenantInput {
  userId: UserId;
  tenantName: string;
  tenantSlug: string;
  orgName: string;
  facilityName: string;
  timezone?: string;
  specialtyPackId?: string;
  practitionerSpecialty?: string;
}

/** Normaliza a slug: minúsculas, sin acentos, guiones, [a-z0-9-]. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export async function provisionTenant(
  db: Database,
  input: ProvisionTenantInput,
): Promise<Result<{ tenantId: TenantId }, DomainError>> {
  const tenantName = input.tenantName.trim();
  const orgName = input.orgName.trim();
  const facilityName = input.facilityName.trim();
  const slug = slugify(input.tenantSlug || input.tenantName);

  if (!tenantName) return err(new ValidationError('El nombre de la clínica es obligatorio.'));
  if (!orgName) return err(new ValidationError('El nombre de la organización es obligatorio.'));
  if (!facilityName) return err(new ValidationError('El nombre del consultorio es obligatorio.'));
  if (!slug) return err(new ValidationError('Identificador (slug) inválido.'));

  // Slug único global: si ya existe, es conflicto (no adoptar tenant ajeno).
  const [existing] = await db
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.slug, slug))
    .limit(1);
  if (existing) return err(new ConflictError(`El identificador "${slug}" ya está en uso.`));

  const [t] = await db
    .insert(tenant)
    .values({ id: newTenantId(), name: tenantName, slug })
    .returning();
  const tenantId = asId<TenantId>(t!.id);

  const [org] = await db
    .insert(organization)
    .values({ id: newOrganizationId(), tenantId, name: orgName })
    .returning();

  await db.insert(facility).values({
    id: newFacilityId(),
    tenantId,
    organizationId: org!.id,
    name: facilityName,
    timezone: input.timezone ?? 'America/Mexico_City',
  });

  const [mem] = await db
    .insert(membership)
    .values({ id: newMembershipId(), tenantId, userId: input.userId, status: 'active' })
    .returning();

  for (const p of BASE_PERMISSIONS) {
    await db.insert(permission).values(p).onConflictDoNothing();
  }

  const [adminRole] = await db
    .insert(role)
    .values({ id: newRoleId(), tenantId, key: 'admin', name: 'Administrador clínico' })
    .returning();
  for (const p of BASE_PERMISSIONS) {
    await db
      .insert(rolePermission)
      .values({ tenantId, roleId: adminRole!.id, permissionKey: p.key })
      .onConflictDoNothing();
  }

  await db
    .insert(membershipRole)
    .values({ tenantId, membershipId: mem!.id, roleId: adminRole!.id })
    .onConflictDoNothing();

  await db.insert(practitioner).values({
    id: newPractitionerId(),
    tenantId,
    userId: input.userId,
    specialty: input.practitionerSpecialty?.trim() || 'Medicina general',
  });

  if (input.specialtyPackId) {
    const ctx = createTenantContext({ tenantId, userId: input.userId });
    await new SpecialtyRepository(db, ctx).setActivePack(input.specialtyPackId);
  }

  return ok({ tenantId });
}

/** ¿El usuario ya tiene alguna membresía activa (ya pertenece a un tenant)? */
export async function userHasActiveTenant(db: Database, userId: UserId): Promise<boolean> {
  const rows = await db
    .select({ id: membership.id })
    .from(membership)
    .where(and(eq(membership.userId, userId), eq(membership.status, 'active')))
    .limit(1);
  return rows.length > 0;
}
