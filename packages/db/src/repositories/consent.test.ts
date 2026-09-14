import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { ConsentRepository } from './consent';

describe('ConsentRepository (§NIVEL 3 governance / §26 LFPDPPP)', () => {
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

  const base = { givenNames: 'Ana', firstSurname: 'P', birthDate: '1990-01-01' } as const;

  it('otorga consentimientos atribuidos y los lista', async () => {
    const p = await new PatientRepository(db, ctx).create(base);
    const repo = new ConsentRepository(db, ctx);
    const c = await repo.grant({ patientId: p.id, type: 'privacy-notice', policyVersion: 'v1' });
    expect(c!.status).toBe('active');
    expect(c!.grantedBy).toBe(ctx.userId);
    await repo.grant({ patientId: p.id, type: 'treatment' });
    expect(await repo.listForPatient(p.id)).toHaveLength(2);
  });

  it('revocar NO borra: marca revoked + fecha/autor (histórico verificable)', async () => {
    const p = await new PatientRepository(db, ctx).create(base);
    const repo = new ConsentRepository(db, ctx);
    const c = await repo.grant({ patientId: p.id, type: 'data-sharing' });
    expect(await repo.revoke(c!.id)).toBe(true);
    const list = await repo.listForPatient(p.id);
    expect(list).toHaveLength(1); // sigue presente
    expect(list[0]!.status).toBe('revoked');
    expect(list[0]!.revokedAt).not.toBeNull();
    // Revocar de nuevo no aplica (ya no está activo).
    expect(await repo.revoke(c!.id)).toBe(false);
  });

  it('no otorga en paciente de otro tenant; lista aislada', async () => {
    const p = await new PatientRepository(db, ctx).create(base);
    expect(
      await new ConsentRepository(db, ctxOther).grant({ patientId: p.id, type: 'treatment' }),
    ).toBeNull();
    await new ConsentRepository(db, ctx).grant({ patientId: p.id, type: 'treatment' });
    expect(await new ConsentRepository(db, ctxOther).listForPatient(p.id)).toHaveLength(0);
  });
});
