import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { RelatedPersonRepository } from './related-person';

describe('RelatedPersonRepository (NIVEL 3)', () => {
  let db: Database;
  let close: () => Promise<void>;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
    const tenantA = newTenantId();
    const tenantB = newTenantId();
    await db.insert(tenant).values([
      { id: tenantA, name: 'A', slug: 'a' },
      { id: tenantB, name: 'B', slug: 'b' },
    ]);
    ctxA = createTenantContext({ tenantId: tenantA, userId: newUserId() });
    ctxB = createTenantContext({ tenantId: tenantB, userId: newUserId() });
  });

  afterEach(async () => {
    await close();
  });

  const child = {
    givenNames: 'Santiago',
    firstSurname: 'Herrera',
    birthDate: '2026-03-01',
    sex: 'male' as const,
  };

  it('registra y lista contactos, con el de emergencia primero', async () => {
    const p = await new PatientRepository(db, ctxA).create(child);
    const repo = new RelatedPersonRepository(db, ctxA);
    await repo.create({ patientId: p.id, name: 'Tía Rosa', relationship: 'caregiver' });
    await repo.create({
      patientId: p.id,
      name: 'Laura Herrera',
      relationship: 'mother',
      phone: '555-1234',
      isEmergencyContact: true,
    });
    const list = await repo.listForPatient(p.id);
    expect(list).toHaveLength(2);
    expect(list[0]!.name).toBe('Laura Herrera'); // emergencia primero
    expect(list[0]!.isEmergencyContact).toBe(true);
  });

  it('no permite adjuntar contactos a un paciente de otro tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(child);
    expect(
      await new RelatedPersonRepository(db, ctxB).create({ patientId: p.id, name: 'Intruso' }),
    ).toBeNull();
    expect(await new RelatedPersonRepository(db, ctxB).listForPatient(p.id)).toHaveLength(0);
  });

  it('listForPatient está aislada por tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(child);
    await new RelatedPersonRepository(db, ctxA).create({
      patientId: p.id,
      name: 'Laura Herrera',
      relationship: 'mother',
    });
    expect(await new RelatedPersonRepository(db, ctxB).listForPatient(p.id)).toHaveLength(0);
  });

  it('softDelete es lógico y no cruza tenants', async () => {
    const p = await new PatientRepository(db, ctxA).create(child);
    const repoA = new RelatedPersonRepository(db, ctxA);
    const r = await repoA.create({ patientId: p.id, name: 'Laura Herrera' });
    expect(await new RelatedPersonRepository(db, ctxB).softDelete(r!.id)).toBe(false);
    expect(await repoA.softDelete(r!.id)).toBe(true);
    expect(await repoA.listForPatient(p.id)).toHaveLength(0);
  });
});
