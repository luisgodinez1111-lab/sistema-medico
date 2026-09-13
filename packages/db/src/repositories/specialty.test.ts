import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { SpecialtyRepository } from './specialty';

describe('SpecialtyRepository (R7)', () => {
  let db: Database;
  let close: () => Promise<void>;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  beforeEach(async () => {
    ({ db, close } = await createTestDatabase());
    const a = newTenantId();
    const b = newTenantId();
    await db.insert(tenant).values([
      { id: a, name: 'A', slug: 'a' },
      { id: b, name: 'B', slug: 'b' },
    ]);
    ctxA = createTenantContext({ tenantId: a, userId: newUserId() });
    ctxB = createTenantContext({ tenantId: b, userId: newUserId() });
  });
  afterEach(async () => {
    await close();
  });

  it('sin elegir, el pack activo es null', async () => {
    expect(await new SpecialtyRepository(db, ctxA).getActivePackId()).toBeNull();
  });

  it('fija y actualiza (upsert) la especialidad del tenant', async () => {
    const repo = new SpecialtyRepository(db, ctxA);
    expect(await repo.setActivePack('medicina-interna')).toBe(true);
    expect(await repo.getActivePackId()).toBe('medicina-interna');
    // Cambiar: upsert, no duplica.
    expect(await repo.setActivePack('medicina-general')).toBe(true);
    expect(await repo.getActivePackId()).toBe('medicina-general');
  });

  it('rechaza packs desconocidos', async () => {
    const repo = new SpecialtyRepository(db, ctxA);
    expect(await repo.setActivePack('inexistente')).toBe(false);
    expect(await repo.getActivePackId()).toBeNull();
  });

  it('está aislada por tenant', async () => {
    await new SpecialtyRepository(db, ctxA).setActivePack('medicina-interna');
    expect(await new SpecialtyRepository(db, ctxB).getActivePackId()).toBeNull();
  });
});
