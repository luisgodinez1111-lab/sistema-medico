import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { EncounterRepository } from './encounter';
import { ExamRepository } from './exam';

describe('ExamRepository (§28 paso 6)', () => {
  let db: Database;
  let close: () => Promise<void>;
  let ctx: TenantContext;
  let ctxOther: TenantContext;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
    const t = newTenantId();
    const other = newTenantId();
    await db.insert(tenant).values([
      { id: t, name: 'T', slug: 't' },
      { id: other, name: 'O', slug: 'o' },
    ]);
    ctx = createTenantContext({ tenantId: t, userId: newUserId() });
    ctxOther = createTenantContext({ tenantId: other, userId: newUserId() });
  });
  afterEach(async () => {
    await close();
  });

  async function draftEncounter(c: TenantContext) {
    const p = await new PatientRepository(db, c).create({
      givenNames: 'Ana',
      firstSurname: 'P',
      birthDate: '1990-01-01',
    });
    const e = await new EncounterRepository(db, c).create({ patientId: p.id });
    return { patientId: p.id, encounterId: e!.id };
  }

  it('upsert idempotente por sección y lista los hallazgos', async () => {
    const { patientId, encounterId } = await draftEncounter(ctx);
    const repo = new ExamRepository(db, ctx);
    expect(
      await repo.setFinding({ encounterId, patientId, section: 'abdomen', normal: true }),
    ).toBe(true);
    // Actualiza la misma sección (no duplica).
    await repo.setFinding({
      encounterId,
      patientId,
      section: 'abdomen',
      normal: false,
      note: 'dolor',
    });
    const rows = await repo.listForEncounter(encounterId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.normal).toBe(false);
    expect(rows[0]!.note).toBe('dolor');
  });

  it('no permite escribir sobre un encuentro firmado', async () => {
    const { patientId, encounterId } = await draftEncounter(ctx);
    await new EncounterRepository(db, ctx).sign(encounterId);
    const ok = await new ExamRepository(db, ctx).setFinding({
      encounterId,
      patientId,
      section: 'abdomen',
      normal: true,
    });
    expect(ok).toBe(false);
  });

  it('no cruza tenants', async () => {
    const { patientId, encounterId } = await draftEncounter(ctx);
    const ok = await new ExamRepository(db, ctxOther).setFinding({
      encounterId,
      patientId,
      section: 'abdomen',
      normal: true,
    });
    expect(ok).toBe(false);
    expect(await new ExamRepository(db, ctxOther).listForEncounter(encounterId)).toHaveLength(0);
  });
});
