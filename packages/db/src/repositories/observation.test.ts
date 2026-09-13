import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { ObservationRepository } from './observation';

describe('ObservationRepository (NIVEL 3)', () => {
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
    givenNames: 'Luis',
    firstSurname: 'Mora',
    birthDate: '1975-09-09',
    sex: 'male' as const,
  };

  it('registra y lista signos vitales del paciente, más reciente primero', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    const repo = new ObservationRepository(db, ctxA);
    await repo.create({
      patientId: p.id,
      code: 'blood-pressure',
      valueText: '138/86',
      unit: 'mmHg',
      effectiveAt: new Date('2026-09-01T10:00:00Z'),
    });
    await repo.create({
      patientId: p.id,
      code: 'weight',
      valueText: '78',
      unit: 'kg',
      effectiveAt: new Date('2026-09-10T10:00:00Z'),
    });
    const list = await repo.listForPatient(p.id);
    expect(list).toHaveLength(2);
    expect(list[0]!.code).toBe('weight'); // más reciente primero
    expect(list[1]!.code).toBe('blood-pressure');
  });

  it('filtra por categoría', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    const repo = new ObservationRepository(db, ctxA);
    await repo.create({ patientId: p.id, code: 'heart-rate', valueText: '72', unit: 'lpm' });
    await repo.create({
      patientId: p.id,
      code: 'glucose',
      valueText: '110',
      unit: 'mg/dL',
      category: 'laboratory',
    });
    expect(await repo.listForPatient(p.id, 'vital-signs')).toHaveLength(1);
    expect(await repo.listForPatient(p.id, 'laboratory')).toHaveLength(1);
  });

  it('no permite adjuntar observaciones a un paciente de otro tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    expect(
      await new ObservationRepository(db, ctxB).create({
        patientId: p.id,
        code: 'temperature',
        valueText: '36.7',
      }),
    ).toBeNull();
    expect(await new ObservationRepository(db, ctxB).listForPatient(p.id)).toHaveLength(0);
  });

  it('listForPatient está aislada por tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    await new ObservationRepository(db, ctxA).create({
      patientId: p.id,
      code: 'spo2',
      valueText: '98',
      unit: '%',
    });
    expect(await new ObservationRepository(db, ctxB).listForPatient(p.id)).toHaveLength(0);
  });

  it('softDelete es lógico y no cruza tenants', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    const repoA = new ObservationRepository(db, ctxA);
    const o = await repoA.create({ patientId: p.id, code: 'weight', valueText: '80', unit: 'kg' });
    expect(await new ObservationRepository(db, ctxB).softDelete(o!.id)).toBe(false);
    expect(await repoA.softDelete(o!.id)).toBe(true);
    expect(await repoA.listForPatient(p.id)).toHaveLength(0);
  });
});
