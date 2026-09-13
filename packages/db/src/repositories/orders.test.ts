import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { ServiceRequestRepository, DiagnosticReportRepository } from './orders';

describe('Orders, Results & Closed-Loop (NIVEL 9)', () => {
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

  it('ciclo completo: solicitar → resultar (completa la orden) → inbox → revisar (cierra)', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const orders = new ServiceRequestRepository(db, ctxA);
    const reports = new DiagnosticReportRepository(db, ctxA);

    const order = await orders.create({ patientId: p.id, code: 'Biometría hemática' });
    expect(order!.status).toBe('requested');

    const result = await reports.enterResult({
      patientId: p.id,
      code: 'Biometría hemática',
      value: 'Hb 9.1 g/dL',
      abnormalFlag: 'low',
      serviceRequestId: order!.id,
    });
    expect(result!.reviewStatus).toBe('pending');
    // La orden quedó completada.
    expect((await orders.getById(order!.id))!.status).toBe('completed');

    // Aparece en el Result Inbox.
    const inbox = await reports.listPendingReview();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]!.id).toBe(result!.id);

    // Revisar cierra la obligación.
    const reviewed = await reports.markReviewed(result!.id, {
      action: 'Ajustar hierro, repetir en 4 semanas',
      patientInformed: true,
    });
    expect(reviewed!.reviewStatus).toBe('reviewed');
    expect(reviewed!.patientInformed).toBe(true);
    expect(await reports.listPendingReview()).toHaveLength(0);
    // Re-revisar no aplica.
    expect(
      await reports.markReviewed(result!.id, { action: 'x', patientInformed: false }),
    ).toBeNull();
  });

  it('el Result Inbox está aislado por tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    await new DiagnosticReportRepository(db, ctxA).enterResult({
      patientId: p.id,
      code: 'Glucosa',
      value: '180 mg/dL',
      abnormalFlag: 'high',
    });
    expect(await new DiagnosticReportRepository(db, ctxA).listPendingReview()).toHaveLength(1);
    expect(await new DiagnosticReportRepository(db, ctxB).listPendingReview()).toHaveLength(0);
  });

  it('no se puede ordenar ni resultar en un paciente de otro tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    expect(
      await new ServiceRequestRepository(db, ctxB).create({ patientId: p.id, code: 'X' }),
    ).toBeNull();
    expect(
      await new DiagnosticReportRepository(db, ctxB).enterResult({
        patientId: p.id,
        code: 'X',
        value: 'y',
      }),
    ).toBeNull();
  });

  it('marcar revisado no cruza tenants', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const r = await new DiagnosticReportRepository(db, ctxA).enterResult({
      patientId: p.id,
      code: 'TSH',
      value: '5.2',
    });
    expect(
      await new DiagnosticReportRepository(db, ctxB).markReviewed(r!.id, {
        action: 'intruso',
        patientInformed: true,
      }),
    ).toBeNull();
    // Sigue pendiente para A.
    expect(await new DiagnosticReportRepository(db, ctxA).listPendingReview()).toHaveLength(1);
  });
});
