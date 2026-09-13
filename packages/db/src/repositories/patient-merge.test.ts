import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId, ValidationError } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { AllergyRepository } from './allergy';
import { ConditionRepository } from './condition';
import { ObservationRepository } from './observation';
import { RelatedPersonRepository } from './related-person';

describe('PatientRepository.merge (NIVEL 3 — duplicados)', () => {
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
    givenNames: 'Juan',
    firstSurname: 'Pérez',
    birthDate: '1988-02-02',
    sex: 'male' as const,
  };

  it('reasigna datos clínicos del duplicado al superviviente y marca merged', async () => {
    const repo = new PatientRepository(db, ctxA);
    const winner = await repo.create({ ...base, mrn: 'W-1' });
    const loser = await repo.create({ ...base, mrn: 'L-1' });

    // El duplicado tiene datos clínicos.
    await new AllergyRepository(db, ctxA).create({ patientId: loser.id, substance: 'Penicilina' });
    await new ConditionRepository(db, ctxA).create({ patientId: loser.id, code: 'Asma' });
    await new ObservationRepository(db, ctxA).create({
      patientId: loser.id,
      code: 'weight',
      valueText: '80',
      unit: 'kg',
    });
    await new RelatedPersonRepository(db, ctxA).create({ patientId: loser.id, name: 'Ana Pérez' });

    const result = await repo.merge({ loserId: loser.id, winnerId: winner.id });
    expect(result).not.toBeNull();
    expect(result!.moved).toEqual({
      allergies: 1,
      conditions: 1,
      observations: 1,
      contacts: 1,
    });

    // Los datos viven ahora en el superviviente.
    expect(await new AllergyRepository(db, ctxA).listForPatient(winner.id)).toHaveLength(1);
    expect(await new ConditionRepository(db, ctxA).listActive(winner.id)).toHaveLength(1);
    expect(await new ObservationRepository(db, ctxA).listForPatient(winner.id)).toHaveLength(1);
    expect(await new RelatedPersonRepository(db, ctxA).listForPatient(winner.id)).toHaveLength(1);

    // El duplicado desaparece de las listas y apunta al superviviente.
    expect(await repo.findById(loser.id)).toBeNull();
    const mergedLoser = await repo.findById(loser.id, { includeDeleted: true });
    expect(mergedLoser!.status).toBe('merged');
    expect(mergedLoser!.mergedIntoId).toBe(winner.id);
  });

  it('es idempotente: re-ejecutar no rompe ni duplica', async () => {
    const repo = new PatientRepository(db, ctxA);
    const winner = await repo.create({ ...base, mrn: 'W-2' });
    const loser = await repo.create({ ...base, mrn: 'L-2' });
    await new ConditionRepository(db, ctxA).create({ patientId: loser.id, code: 'HTA' });

    const first = await repo.merge({ loserId: loser.id, winnerId: winner.id });
    expect(first!.moved.conditions).toBe(1);
    // Segunda pasada: ya no hay rezagados (el perdedor sigue marcado).
    const second = await repo.merge({ loserId: loser.id, winnerId: winner.id });
    expect(second!.moved.conditions).toBe(0);
    expect(await new ConditionRepository(db, ctxA).listActive(winner.id)).toHaveLength(1);
  });

  it('hereda la revisión de alergias (NKDA) del duplicado si el superviviente no la tenía', async () => {
    const repo = new PatientRepository(db, ctxA);
    const winner = await repo.create({ ...base, mrn: 'W-3' });
    const loser = await repo.create({ ...base, mrn: 'L-3' });
    await new AllergyRepository(db, ctxA).markReviewed(loser.id); // NKDA en el duplicado

    await repo.merge({ loserId: loser.id, winnerId: winner.id });
    const w = await repo.findById(winner.id);
    expect(w!.allergiesReviewedAt).not.toBeNull();
  });

  it('rechaza fusionar un paciente consigo mismo', async () => {
    const repo = new PatientRepository(db, ctxA);
    const p = await repo.create({ ...base, mrn: 'X-1' });
    await expect(repo.merge({ loserId: p.id, winnerId: p.id })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('no fusiona a través de tenants (devuelve null)', async () => {
    const winner = await new PatientRepository(db, ctxA).create({ ...base, mrn: 'W-4' });
    const loser = await new PatientRepository(db, ctxB).create({ ...base, mrn: 'L-4' });
    // ctxA no puede tocar al perdedor de B.
    expect(
      await new PatientRepository(db, ctxA).merge({ loserId: loser.id, winnerId: winner.id }),
    ).toBeNull();
    // El perdedor de B sigue intacto.
    expect(await new PatientRepository(db, ctxB).findById(loser.id)).not.toBeNull();
  });
});
