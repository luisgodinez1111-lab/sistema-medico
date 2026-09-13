import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { EncounterRepository } from './encounter';
import { EncounterAddendumRepository } from './encounter-addendum';

describe('EncounterAddendumRepository (§NIVEL 6, §33 #6)', () => {
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

  async function encounterOf(c: TenantContext, sign: boolean) {
    const p = await new PatientRepository(db, c).create({
      givenNames: 'Ana',
      firstSurname: 'P',
      birthDate: '1990-01-01',
    });
    const repo = new EncounterRepository(db, c);
    const e = await repo.create({ patientId: p.id });
    if (sign) await repo.sign(e!.id);
    return { patientId: p.id, encounterId: e!.id };
  }

  it('añade enmiendas a un encuentro firmado, en orden y atribuidas', async () => {
    const { patientId, encounterId } = await encounterOf(ctx, true);
    const repo = new EncounterAddendumRepository(db, ctx);
    expect(await repo.add(encounterId, patientId, 'Corrijo la dosis')).not.toBeNull();
    await repo.add(encounterId, patientId, 'Aclaración adicional');
    const list = await repo.listForEncounter(encounterId);
    expect(list.map((a) => a.text)).toEqual(['Corrijo la dosis', 'Aclaración adicional']);
    expect(list[0]!.authorId).toBe(ctx.userId);
  });

  it('NO permite enmendar un borrador (sólo notas firmadas)', async () => {
    const { patientId, encounterId } = await encounterOf(ctx, false);
    expect(
      await new EncounterAddendumRepository(db, ctx).add(encounterId, patientId, 'x'),
    ).toBeNull();
  });

  it('rechaza texto vacío', async () => {
    const { patientId, encounterId } = await encounterOf(ctx, true);
    expect(
      await new EncounterAddendumRepository(db, ctx).add(encounterId, patientId, '   '),
    ).toBeNull();
  });

  it('está aislado por tenant', async () => {
    const { patientId, encounterId } = await encounterOf(ctx, true);
    expect(
      await new EncounterAddendumRepository(db, ctxOther).add(encounterId, patientId, 'x'),
    ).toBeNull();
    await new EncounterAddendumRepository(db, ctx).add(encounterId, patientId, 'ok');
    expect(
      await new EncounterAddendumRepository(db, ctxOther).listForEncounter(encounterId),
    ).toHaveLength(0);
  });
});
