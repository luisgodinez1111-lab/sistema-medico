import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { ConditionRepository } from './condition';
import { EncounterRepository } from './encounter';
import { EncounterDiagnosisRepository } from './encounter-diagnosis';

describe('EncounterDiagnosisRepository (§28 paso 7)', () => {
  let db: Database;
  let close: () => Promise<void>;
  let ctx: TenantContext;
  let ctxOther: TenantContext;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
    const t = newTenantId();
    const o = newTenantId();
    await db.insert(tenant).values([
      { id: t, name: 'T', slug: 't' },
      { id: o, name: 'O', slug: 'o' },
    ]);
    ctx = createTenantContext({ tenantId: t, userId: newUserId() });
    ctxOther = createTenantContext({ tenantId: o, userId: newUserId() });
  });
  afterEach(async () => {
    await close();
  });

  async function setup(c: TenantContext) {
    const p = await new PatientRepository(db, c).create({
      givenNames: 'Ana',
      firstSurname: 'P',
      birthDate: '1990-01-01',
    });
    const c1 = await new ConditionRepository(db, c).create({ patientId: p.id, code: 'Diabetes' });
    const c2 = await new ConditionRepository(db, c).create({ patientId: p.id, code: 'HTA' });
    const e = await new EncounterRepository(db, c).create({ patientId: p.id });
    return { patientId: p.id, c1: c1!.id, c2: c2!.id, encounterId: e!.id };
  }

  it('fija y reemplaza el conjunto de diagnósticos (con su texto)', async () => {
    const { patientId, c1, c2, encounterId } = await setup(ctx);
    const repo = new EncounterDiagnosisRepository(db, ctx);
    expect(await repo.setDiagnoses(encounterId, patientId, [c1, c2])).toBe(true);
    let list = await repo.listForEncounter(encounterId);
    expect(list.map((d) => d.code).sort()).toEqual(['Diabetes', 'HTA']);
    // Reemplazo por solo uno.
    await repo.setDiagnoses(encounterId, patientId, [c1]);
    list = await repo.listForEncounter(encounterId);
    expect(list.map((d) => d.code)).toEqual(['Diabetes']);
  });

  it('ignora Conditions que no son del paciente/tenant', async () => {
    const { patientId, encounterId } = await setup(ctx);
    const foreign = await setup(ctxOther);
    const repo = new EncounterDiagnosisRepository(db, ctx);
    await repo.setDiagnoses(encounterId, patientId, [foreign.c1]);
    expect(await repo.listForEncounter(encounterId)).toHaveLength(0);
  });

  it('no permite escribir sobre un encuentro firmado', async () => {
    const { patientId, c1, encounterId } = await setup(ctx);
    await new EncounterRepository(db, ctx).sign(encounterId);
    expect(
      await new EncounterDiagnosisRepository(db, ctx).setDiagnoses(encounterId, patientId, [c1]),
    ).toBe(false);
  });

  it('está aislado por tenant', async () => {
    const { patientId, c1, encounterId } = await setup(ctx);
    await new EncounterDiagnosisRepository(db, ctx).setDiagnoses(encounterId, patientId, [c1]);
    expect(
      await new EncounterDiagnosisRepository(db, ctxOther).listForEncounter(encounterId),
    ).toHaveLength(0);
  });
});
