import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { AllergyRepository } from './allergy';
import { MedicationRepository } from './medication';
import { checkPrescription, hasCritical, SAFETY_RULESET_VERSION } from '../prescription-safety';

describe('Prescripción y seguridad (NIVEL 8)', () => {
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

  // --- Motor de seguridad (puro) ---
  it('alerta crítica por alergia relacionada; versión del ruleset incluida', () => {
    const alerts = checkPrescription({
      drug: 'Penicilina G',
      allergies: [{ substance: 'Penicilina' }],
      activeMedications: [],
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.code).toBe('allergy-contraindication');
    expect(alerts[0]!.severity).toBe('critical');
    expect(alerts[0]!.rulesetVersion).toBe(SAFETY_RULESET_VERSION);
    expect(hasCritical(alerts)).toBe(true);
  });

  it('alerta de duplicidad (warning) si ya hay medicación activa relacionada', () => {
    const alerts = checkPrescription({
      drug: 'Metformina',
      allergies: [],
      activeMedications: [{ drug: 'Metformina 850mg' }],
    });
    expect(alerts.map((a) => a.code)).toEqual(['duplicate-therapy']);
    expect(hasCritical(alerts)).toBe(false);
  });

  it('sin hallazgos → sin alertas', () => {
    expect(
      checkPrescription({
        drug: 'Losartán',
        allergies: [{ substance: 'Penicilina' }],
        activeMedications: [],
      }),
    ).toHaveLength(0);
  });

  it('interacción fármaco-fármaco (catálogo DEMO) marcada con source=demo', () => {
    const alerts = checkPrescription({
      drug: 'Ibuprofeno 400mg',
      allergies: [],
      activeMedications: [{ drug: 'Warfarina 5mg' }],
    });
    const inter = alerts.find((a) => a.code === 'drug-interaction');
    expect(inter).toBeTruthy();
    expect(inter!.severity).toBe('critical');
    expect(inter!.source).toBe('demo');
  });

  // --- Repositorio (con BD) ---
  it('checkSafety usa las alergias reales del paciente (scoped)', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    await new AllergyRepository(db, ctxA).create({
      patientId: p.id,
      substance: 'Penicilina',
      criticality: 'high',
    });
    const repo = new MedicationRepository(db, ctxA);
    const alerts = await repo.checkSafety(p.id, 'Amoxicilina/Penicilina');
    expect(hasCritical(alerts)).toBe(true);
    // Un fármaco no relacionado no alerta.
    expect(await repo.checkSafety(p.id, 'Paracetamol')).toHaveLength(0);
  });

  it('prescribe y lista activas; detecta duplicidad en la segunda', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new MedicationRepository(db, ctxA);
    await repo.prescribe({
      patientId: p.id,
      drug: 'Metformina',
      dose: '850 mg',
      frequency: 'c/12h',
    });
    expect(await repo.listActiveForPatient(p.id)).toHaveLength(1);
    const alerts = await repo.checkSafety(p.id, 'Metformina');
    expect(alerts.map((a) => a.code)).toContain('duplicate-therapy');
  });

  it('no prescribe a paciente de otro tenant; checkSafety aislado', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    await new AllergyRepository(db, ctxA).create({ patientId: p.id, substance: 'Penicilina' });
    expect(
      await new MedicationRepository(db, ctxB).prescribe({ patientId: p.id, drug: 'X' }),
    ).toBeNull();
    // B no ve las alergias de A → sin alerta crítica (aislamiento).
    expect(await new MedicationRepository(db, ctxB).checkSafety(p.id, 'Penicilina')).toHaveLength(
      0,
    );
  });

  it('stop suspende una activa y la saca de la lista', async () => {
    const p = await new PatientRepository(db, ctxA).create(base);
    const repo = new MedicationRepository(db, ctxA);
    const m = await repo.prescribe({ patientId: p.id, drug: 'Ibuprofeno' });
    expect(await repo.stop(m!.id)).toBe(true);
    expect(await repo.listActiveForPatient(p.id)).toHaveLength(0);
  });
});
