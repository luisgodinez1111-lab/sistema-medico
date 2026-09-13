import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newUserId } from '@medical-os/shared';
import type { Database } from './client';
import { createTestDatabase } from './testing';
import { provisionTenant, userHasActiveTenant, slugify } from './provisioning';
import { resolveTenantContextForUser } from './context-resolver';
import { SpecialtyRepository } from './repositories/specialty';

describe('provisioning (onboarding §28 paso 1)', () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
  });
  afterEach(async () => {
    await close();
  });

  it('slugify normaliza acentos y espacios', () => {
    expect(slugify('Clínica Estética Fernández')).toBe('clinica-estetica-fernandez');
  });

  it('aprovisiona tenant completo y deja al usuario como admin con permisos', async () => {
    const userId = newUserId();
    const res = await provisionTenant(db, {
      userId,
      tenantName: 'Clínica Nova',
      tenantSlug: 'Clínica Nova',
      orgName: 'Nova Salud',
      facilityName: 'Sede Centro',
      specialtyPackId: 'medicina-estetica',
      practitionerSpecialty: 'Dermatología',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // El contexto se resuelve por el usuario y trae los permisos de admin.
    const ctx = await resolveTenantContextForUser(db, { userId });
    expect(ctx).not.toBeNull();
    expect(ctx!.permissions.has('patient.write')).toBe(true);
    expect(ctx!.permissions.has('organization.manage')).toBe(true);
    expect(ctx!.permissions.has('encounter.sign')).toBe(true);

    // La especialidad quedó activa.
    expect(await new SpecialtyRepository(db, ctx!).getActivePackId()).toBe('medicina-estetica');
  });

  it('userHasActiveTenant refleja el alta', async () => {
    const userId = newUserId();
    expect(await userHasActiveTenant(db, userId)).toBe(false);
    await provisionTenant(db, {
      userId,
      tenantName: 'C',
      tenantSlug: 'clinica-c',
      orgName: 'O',
      facilityName: 'F',
    });
    expect(await userHasActiveTenant(db, userId)).toBe(true);
  });

  it('rechaza slug duplicado con ConflictError', async () => {
    await provisionTenant(db, {
      userId: newUserId(),
      tenantName: 'Uno',
      tenantSlug: 'misma-clinica',
      orgName: 'O',
      facilityName: 'F',
    });
    const dup = await provisionTenant(db, {
      userId: newUserId(),
      tenantName: 'Dos',
      tenantSlug: 'misma-clinica',
      orgName: 'O',
      facilityName: 'F',
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('CONFLICT');
  });

  it('dos clínicas quedan aisladas: cada usuario ve solo la suya', async () => {
    const userA = newUserId();
    const userB = newUserId();
    await provisionTenant(db, {
      userId: userA,
      tenantName: 'A',
      tenantSlug: 'a',
      orgName: 'OA',
      facilityName: 'FA',
    });
    await provisionTenant(db, {
      userId: userB,
      tenantName: 'B',
      tenantSlug: 'b',
      orgName: 'OB',
      facilityName: 'FB',
    });
    const ctxA = await resolveTenantContextForUser(db, { userId: userA });
    const ctxB = await resolveTenantContextForUser(db, { userId: userB });
    expect(ctxA!.tenantId).not.toBe(ctxB!.tenantId);
  });
});
