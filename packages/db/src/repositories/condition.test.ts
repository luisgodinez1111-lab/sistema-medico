import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { ConditionRepository } from './condition';

describe('ConditionRepository (NIVEL 3)', () => {
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
    givenNames: 'Ana',
    firstSurname: 'López',
    birthDate: '1980-05-05',
    sex: 'female' as const,
  };

  it('registra y lista problemas activos del paciente', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    const repo = new ConditionRepository(db, ctxA);
    expect(await repo.create({ patientId: p.id, code: 'Diabetes mellitus tipo 2' })).not.toBeNull();
    const list = await repo.listActive(p.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.code).toBe('Diabetes mellitus tipo 2');
    expect(list[0]!.clinicalStatus).toBe('active');
  });

  it('un problema resuelto sale de la lista de activos pero queda en el historial', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    const repo = new ConditionRepository(db, ctxA);
    const c = await repo.create({ patientId: p.id, code: 'Faringitis aguda' });
    expect(await repo.setStatus(c!.id, 'resolved')).toBe(true);
    expect(await repo.listActive(p.id)).toHaveLength(0);
    expect(await repo.listAll(p.id)).toHaveLength(1);
  });

  it('no permite adjuntar problemas a un paciente de otro tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    expect(
      await new ConditionRepository(db, ctxB).create({ patientId: p.id, code: 'HTA' }),
    ).toBeNull();
    expect(await new ConditionRepository(db, ctxB).listActive(p.id)).toHaveLength(0);
  });

  it('listActive está aislada por tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    await new ConditionRepository(db, ctxA).create({ patientId: p.id, code: 'Asma' });
    expect(await new ConditionRepository(db, ctxB).listActive(p.id)).toHaveLength(0);
  });

  it('softDelete es lógico y no cruza tenants', async () => {
    const p = await new PatientRepository(db, ctxA).create(patientBase);
    const repoA = new ConditionRepository(db, ctxA);
    const c = await repoA.create({ patientId: p.id, code: 'Migraña' });
    expect(await new ConditionRepository(db, ctxB).softDelete(c!.id)).toBe(false);
    expect(await repoA.softDelete(c!.id)).toBe(true);
    expect(await repoA.listActive(p.id)).toHaveLength(0);
  });
});
