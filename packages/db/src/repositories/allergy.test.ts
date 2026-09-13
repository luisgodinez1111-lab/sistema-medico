import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { AllergyRepository } from './allergy';

describe('AllergyRepository (NIVEL 3)', () => {
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

  const patientBase = {
    givenNames: 'María',
    firstSurname: 'Ruiz',
    birthDate: '1990-01-01',
    sex: 'female' as const,
  };

  it('registra una alergia y la lista para el paciente', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    const repo = new AllergyRepository(db, ctxA);
    const created = await repo.create({
      patientId: p.id,
      substance: 'Penicilina',
      category: 'medication',
      criticality: 'high',
      reaction: 'anafilaxia',
    });
    expect(created).not.toBeNull();
    const list = await repo.listForPatient(p.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.substance).toBe('Penicilina');
    expect(list[0]!.criticality).toBe('high');
  });

  it('registrar una alergia marca el paciente como revisado (NKDA vs no evaluado)', async () => {
    const patientRepo = new PatientRepository(db, ctxA);
    const p = await patientRepo.create(patientBase);
    expect((await patientRepo.findById(p.id))!.allergiesReviewedAt).toBeNull();

    await new AllergyRepository(db, ctxA).create({ patientId: p.id, substance: 'Látex' });
    expect((await patientRepo.findById(p.id))!.allergiesReviewedAt).not.toBeNull();
  });

  it('markReviewed sella NKDA sin crear alergias', async () => {
    const patientRepo = new PatientRepository(db, ctxA);
    const p = await patientRepo.create(patientBase);
    expect(await new AllergyRepository(db, ctxA).markReviewed(p.id)).toBe(true);
    expect((await patientRepo.findById(p.id))!.allergiesReviewedAt).not.toBeNull();
    expect(await new AllergyRepository(db, ctxA).listForPatient(p.id)).toHaveLength(0);
  });

  it('no permite adjuntar alergias a un paciente de otro tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    const result = await new AllergyRepository(db, ctxB).create({
      patientId: p.id,
      substance: 'Penicilina',
    });
    expect(result).toBeNull();
    // Y no aparece nada para B ni contamina a A.
    expect(await new AllergyRepository(db, ctxB).listForPatient(p.id)).toHaveLength(0);
    expect(await new AllergyRepository(db, ctxA).listForPatient(p.id)).toHaveLength(0);
  });

  it('listForPatient está aislada por tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    await new AllergyRepository(db, ctxA).create({ patientId: p.id, substance: 'Sulfas' });
    // B conoce el id del paciente pero no ve sus alergias.
    expect(await new AllergyRepository(db, ctxB).listForPatient(p.id)).toHaveLength(0);
  });

  it('softDelete es lógico y no cruza tenants', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    const repoA = new AllergyRepository(db, ctxA);
    const a = await repoA.create({ patientId: p.id, substance: 'AINES' });
    expect(await new AllergyRepository(db, ctxB).softDelete(a!.id)).toBe(false);
    expect(await repoA.softDelete(a!.id)).toBe(true);
    expect(await repoA.listForPatient(p.id)).toHaveLength(0);
  });
});
