import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { ArcoRepository } from './arco';

describe('ArcoRepository (§NIVEL 18 derechos ARCO / LFPDPPP)', () => {
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

  it('crea una solicitud con plazo legal (due_date futuro) y estado recibido', async () => {
    const repo = new ArcoRepository(db, ctx);
    const req = await repo.create({ type: 'access', requesterName: 'Ana Pérez' });
    expect(req).not.toBeNull();
    expect(req!.status).toBe('received');
    expect(req!.createdBy).toBe(ctx.userId);
    // Plazo: due_date estrictamente posterior a la recepción.
    expect(new Date(req!.dueDate).getTime()).toBeGreaterThan(req!.receivedAt.getTime());
  });

  it('valida titular del tenant y aísla el listado por tenant', async () => {
    const p = await new PatientRepository(db, ctx).create(base);
    // Otro tenant no puede crear ligada a un paciente ajeno.
    expect(
      await new ArcoRepository(db, ctxOther).create({
        patientId: p.id,
        type: 'rectification',
        requesterName: 'X',
      }),
    ).toBeNull();
    await new ArcoRepository(db, ctx).create({
      patientId: p.id,
      type: 'rectification',
      requesterName: 'Ana',
    });
    expect(await new ArcoRepository(db, ctx).list()).toHaveLength(1);
    expect(await new ArcoRepository(db, ctxOther).list()).toHaveLength(0);
  });

  it('flujo: recibida → en revisión → resuelta (atribuida y fechada)', async () => {
    const repo = new ArcoRepository(db, ctx);
    const req = await repo.create({ type: 'cancellation', requesterName: 'Ana' });
    expect(await repo.markInReview(req!.id)).toBe(true);
    expect(await repo.markInReview(req!.id)).toBe(false); // ya no está "received"

    expect(
      await repo.resolve(req!.id, { outcome: 'granted', resolution: 'Datos cancelados.' }),
    ).toBe(true);
    const resolved = await repo.getById(req!.id);
    expect(resolved!.status).toBe('completed');
    expect(resolved!.outcome).toBe('granted');
    expect(resolved!.resolvedBy).toBe(ctx.userId);
    expect(resolved!.resolvedAt).not.toBeNull();
    // No se puede resolver dos veces.
    expect(await repo.resolve(req!.id, { outcome: 'denied', resolution: 'x' })).toBe(false);
  });

  it('listOpen excluye resueltas/rechazadas', async () => {
    const repo = new ArcoRepository(db, ctx);
    const a = await repo.create({ type: 'access', requesterName: 'A' });
    await repo.create({ type: 'opposition', requesterName: 'B' });
    await repo.resolve(a!.id, {
      outcome: 'denied',
      resolution: 'Improcedente.',
      status: 'rejected',
    });
    const open = await repo.listOpen();
    expect(open).toHaveLength(1);
    expect(open[0]!.requesterName).toBe('B');
  });
});
