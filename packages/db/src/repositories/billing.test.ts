import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { BillingRepository } from './billing';

describe('BillingRepository (R3 — facturación básica)', () => {
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

  const base = {
    givenNames: 'Ana',
    firstSurname: 'Soto',
    birthDate: '1985-06-06',
    sex: 'female' as const,
  };

  it('crea factura con líneas y calcula el total en centavos', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new BillingRepository(db, ctxA);
    const inv = await repo.createInvoice({
      patientId: p.id,
      items: [
        { description: 'Consulta', quantity: 1, unitPriceCents: 80000 },
        { description: 'Curación', quantity: 2, unitPriceCents: 15000 },
      ],
    });
    expect(inv!.status).toBe('draft');
    expect(inv!.totalCents).toBe(80000 + 2 * 15000); // 110000 = $1,100.00
    expect(inv!.currency).toBe('MXN');
    const items = await repo.getItems(inv!.id);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.description === 'Curación')!.amountCents).toBe(30000);
  });

  it('una factura sin líneas válidas no se crea', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new BillingRepository(db, ctxA);
    expect(
      await repo.createInvoice({
        patientId: p.id,
        items: [{ description: '', quantity: 0, unitPriceCents: 0 }],
      }),
    ).toBeNull();
  });

  it('transiciones draft → issued → paid; no se repiten', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new BillingRepository(db, ctxA);
    const inv = await repo.createInvoice({
      patientId: p.id,
      items: [{ description: 'Consulta', quantity: 1, unitPriceCents: 50000 }],
    });
    expect(await repo.markPaid(inv!.id)).toBe(false); // aún draft, no issued
    expect(await repo.issue(inv!.id)).toBe(true);
    expect(await repo.issue(inv!.id)).toBe(false); // ya no está draft
    expect(await repo.markPaid(inv!.id)).toBe(true);
    expect(await repo.markPaid(inv!.id)).toBe(false); // ya paid
  });

  it('no crea ni transiciona facturas de otro tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    expect(
      await new BillingRepository(db, ctxB).createInvoice({
        patientId: p.id,
        items: [{ description: 'x', quantity: 1, unitPriceCents: 100 }],
      }),
    ).toBeNull();
    const inv = await new BillingRepository(db, ctxA).createInvoice({
      patientId: p.id,
      items: [{ description: 'Consulta', quantity: 1, unitPriceCents: 100 }],
    });
    expect(await new BillingRepository(db, ctxB).issue(inv!.id)).toBe(false);
    expect(await new BillingRepository(db, ctxB).listForPatient(p.id)).toHaveLength(0);
  });
});
