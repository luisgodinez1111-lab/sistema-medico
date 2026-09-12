import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant, appUser } from '../schema';
import { OrganizationRepository } from './organization';
import { FacilityRepository } from './facility';
import { AuditRepository } from './audit';

/**
 * Gate de NIVEL 2 (ADR-0002 §6): pruebas cross-tenant / IDOR / BOLA.
 * Deben demostrar que NINGÚN contexto de un tenant puede leer, modificar o
 * borrar recursos de otro tenant. Si el aislamiento se rompe, estas pruebas
 * fallan y la puerta de salida del nivel no se cruza.
 */
describe('aislamiento multi-tenant (gate NIVEL 2)', () => {
  let db: Database;
  let close: () => Promise<void>;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());

    const tenantA = newTenantId();
    const tenantB = newTenantId();
    const userA = newUserId();
    const userB = newUserId();

    // Semilla mínima: dos tenants con un usuario cada uno.
    await db.insert(tenant).values([
      { id: tenantA, name: 'Clínica A', slug: 'clinica-a' },
      { id: tenantB, name: 'Clínica B', slug: 'clinica-b' },
    ]);
    await db.insert(appUser).values([
      { id: userA, email: 'a@a.com', displayName: 'Dr A', status: 'active' },
      { id: userB, email: 'b@b.com', displayName: 'Dr B', status: 'active' },
    ]);

    ctxA = createTenantContext({ tenantId: tenantA, userId: userA });
    ctxB = createTenantContext({ tenantId: tenantB, userId: userB });
  });

  afterEach(async () => {
    await close();
  });

  it('list() solo devuelve recursos del propio tenant', async () => {
    await new OrganizationRepository(db, ctxA).create({ name: 'Org A' });
    await new OrganizationRepository(db, ctxB).create({ name: 'Org B' });

    const fromA = await new OrganizationRepository(db, ctxA).list();
    const fromB = await new OrganizationRepository(db, ctxB).list();

    expect(fromA).toHaveLength(1);
    expect(fromA[0]!.name).toBe('Org A');
    expect(fromB).toHaveLength(1);
    expect(fromB[0]!.name).toBe('Org B');
  });

  it('findById() de un recurso de otro tenant devuelve null (bloqueo IDOR/BOLA)', async () => {
    const orgA = await new OrganizationRepository(db, ctxA).create({ name: 'Org A' });

    // B conoce el ULID de A (fuga de ID) e intenta leerlo directamente.
    const leaked = await new OrganizationRepository(db, ctxB).findById(orgA.id);

    expect(leaked).toBeNull();
    // A sí puede leer lo suyo.
    expect(await new OrganizationRepository(db, ctxA).findById(orgA.id)).not.toBeNull();
  });

  it('rename() no puede modificar recursos de otro tenant', async () => {
    const orgA = await new OrganizationRepository(db, ctxA).create({ name: 'Org A' });

    const result = await new OrganizationRepository(db, ctxB).rename(orgA.id, 'HACKED');

    expect(result).toBeNull();
    const stillA = await new OrganizationRepository(db, ctxA).findById(orgA.id);
    expect(stillA!.name).toBe('Org A');
  });

  it('delete() no puede borrar recursos de otro tenant', async () => {
    const orgA = await new OrganizationRepository(db, ctxA).create({ name: 'Org A' });

    const deleted = await new OrganizationRepository(db, ctxB).delete(orgA.id);

    expect(deleted).toBe(false);
    expect(await new OrganizationRepository(db, ctxA).findById(orgA.id)).not.toBeNull();
  });

  it('create() fuerza el tenant del contexto (no se puede inyectar otro)', async () => {
    // Aun si el llamador "quisiera" otro tenant, el repo solo usa ctx.tenantId.
    const org = await new OrganizationRepository(db, ctxA).create({ name: 'Org A' });
    expect(org.tenantId).toBe(ctxA.tenantId);
  });

  it('facilities quedan aisladas por tenant', async () => {
    const orgA = await new OrganizationRepository(db, ctxA).create({ name: 'Org A' });
    const facA = await new FacilityRepository(db, ctxA).create({
      organizationId: orgA.id,
      name: 'Sede A',
    });

    expect(await new FacilityRepository(db, ctxB).findById(facA.id)).toBeNull();
    expect(await new FacilityRepository(db, ctxA).findById(facA.id)).not.toBeNull();

    // B no ve las facilities de la organización de A aunque conozca el orgId.
    const facsSeenByB = await new FacilityRepository(db, ctxB).listByOrganization(orgA.id);
    expect(facsSeenByB).toHaveLength(0);
  });

  it('la auditoría cross-tenant queda registrada en el tenant correcto', async () => {
    const orgA = await new OrganizationRepository(db, ctxA).create({ name: 'Org A' });

    // B intenta y falla; el sistema audita el intento en el contexto de B.
    const attempt = await new OrganizationRepository(db, ctxB).findById(orgA.id);
    expect(attempt).toBeNull();

    const auditB = new AuditRepository(db, ctxB);
    await auditB.recordCrossTenantDenied('organization', orgA.id);

    const eventsB = await auditB.listRecent();
    expect(eventsB).toHaveLength(1);
    expect(eventsB[0]!.action).toBe('cross_tenant_denied');
    expect(eventsB[0]!.tenantId).toBe(ctxB.tenantId);

    // El tenant A no ve los eventos de B.
    const eventsA = await new AuditRepository(db, ctxA).listRecent();
    expect(eventsA).toHaveLength(0);
  });
});
