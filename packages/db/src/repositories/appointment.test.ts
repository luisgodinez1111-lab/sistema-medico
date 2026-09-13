import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { AppointmentRepository } from './appointment';

describe('AppointmentRepository (R3 — Agenda)', () => {
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

  const day = new Date('2026-09-15T00:00:00Z');
  const dayEnd = new Date('2026-09-16T00:00:00Z');

  it('crea una cita y la lista en el día correspondiente', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new AppointmentRepository(db, ctxA);
    const appt = await repo.create({
      patientId: p.id,
      startAt: new Date('2026-09-15T10:00:00Z'),
      reason: 'Control',
    });
    expect(appt!.status).toBe('booked');
    expect(appt!.durationMinutes).toBe(30);
    const dayList = await repo.listForDay(day, dayEnd);
    expect(dayList).toHaveLength(1);
    // Otro día no la incluye.
    expect(
      await repo.listForDay(new Date('2026-09-16T00:00:00Z'), new Date('2026-09-17T00:00:00Z')),
    ).toHaveLength(0);
  });

  it('check-in mueve booked → arrived y sella la llegada; no re-aplica', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new AppointmentRepository(db, ctxA);
    const appt = await repo.create({ patientId: p.id, startAt: new Date('2026-09-15T11:00:00Z') });
    expect(await repo.checkIn(appt!.id)).toBe(true);
    const after = (await repo.listForPatient(p.id))[0]!;
    expect(after.status).toBe('arrived');
    expect(after.arrivedAt).not.toBeNull();
    // Segundo check-in no aplica (ya no está en booked).
    expect(await repo.checkIn(appt!.id)).toBe(false);
  });

  it('no crea cita en paciente de otro tenant; agenda aislada', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    expect(
      await new AppointmentRepository(db, ctxB).create({ patientId: p.id, startAt: day }),
    ).toBeNull();
    await new AppointmentRepository(db, ctxA).create({
      patientId: p.id,
      startAt: new Date('2026-09-15T09:00:00Z'),
    });
    expect(await new AppointmentRepository(db, ctxB).listForDay(day, dayEnd)).toHaveLength(0);
    expect(await new AppointmentRepository(db, ctxA).listForDay(day, dayEnd)).toHaveLength(1);
  });

  it('check-in y setStatus no cruzan tenants', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const appt = await new AppointmentRepository(db, ctxA).create({
      patientId: p.id,
      startAt: day,
    });
    expect(await new AppointmentRepository(db, ctxB).checkIn(appt!.id)).toBe(false);
    expect(await new AppointmentRepository(db, ctxB).setStatus(appt!.id, 'cancelled')).toBe(false);
  });
});
