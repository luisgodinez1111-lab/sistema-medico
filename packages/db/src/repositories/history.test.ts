import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newTenantId, newUserId } from '@medical-os/shared';
import type { Database } from '../client';
import { createTestDatabase } from '../testing';
import { createTenantContext, type TenantContext } from '../tenant-context';
import { tenant } from '../schema';
import { PatientRepository } from './patient';
import { HistoryRepository } from './history';
import { applicableHistorySections, HISTORY_SCHEMA_VERSION } from '../clinical-history';

describe('Historia clínica adaptativa (NIVEL 5)', () => {
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

  const adultFemale = {
    givenNames: 'María',
    firstSurname: 'Ruiz',
    birthDate: '1991-04-12',
    sex: 'female' as const,
  };

  // --- Motor adaptativo (sin BD) ---
  it('adulto ve personales y no-patológicos; mujer adulta además gineco-obstétricos', () => {
    const male = applicableHistorySections({ ageYears: 40, sex: 'male' }).map((s) => s.section);
    const female = applicableHistorySections({ ageYears: 40, sex: 'female' }).map((s) => s.section);
    expect(male).toContain('personales-patologicos');
    expect(male).not.toContain('gineco-obstetricos');
    expect(female).toContain('gineco-obstetricos');
    expect(female).not.toContain('perinatales');
  });

  it('pediátrico ve perinatales e inmunizaciones; lactante además desarrollo', () => {
    const infant = applicableHistorySections({ ageYears: 0, sex: 'male' }).map((s) => s.section);
    const school = applicableHistorySections({ ageYears: 8, sex: 'male' }).map((s) => s.section);
    expect(infant).toContain('perinatales');
    expect(infant).toContain('desarrollo');
    expect(infant).toContain('inmunizaciones');
    expect(school).toContain('perinatales');
    expect(school).not.toContain('desarrollo'); // >5 años
    expect(infant).not.toContain('gineco-obstetricos');
  });

  // --- Repositorio (con BD) ---
  it('setEntry hace upsert por section+code y sella la versión del esquema', async () => {
    const p = await new PatientRepository(db, ctxA).create(adultFemale);
    const repo = new HistoryRepository(db, ctxA);

    const created = await repo.setEntry({
      patientId: p.id,
      section: 'heredofamiliares',
      code: 'diabetes',
      value: 'Madre con DM2',
    });
    expect(created!.schemaVersion).toBe(HISTORY_SCHEMA_VERSION);
    expect(await repo.listForPatient(p.id)).toHaveLength(1);

    // Mismo ítem: actualiza, no duplica.
    const updated = await repo.setEntry({
      patientId: p.id,
      section: 'heredofamiliares',
      code: 'diabetes',
      value: 'Madre y abuela con DM2',
    });
    expect(updated!.id).toBe(created!.id);
    expect(await repo.listForPatient(p.id)).toHaveLength(1);
    expect(updated!.value).toBe('Madre y abuela con DM2');
  });

  it('un valor vacío borra (baja lógica) el ítem existente', async () => {
    const p = await new PatientRepository(db, ctxA).create(adultFemale);
    const repo = new HistoryRepository(db, ctxA);
    await repo.setEntry({
      patientId: p.id,
      section: 'personales-no-patologicos',
      code: 'tabaquismo',
      value: 'Sí',
    });
    expect(await repo.listForPatient(p.id)).toHaveLength(1);
    await repo.setEntry({
      patientId: p.id,
      section: 'personales-no-patologicos',
      code: 'tabaquismo',
      value: '  ',
    });
    expect(await repo.listForPatient(p.id)).toHaveLength(0);
  });

  it('no permite escribir historia en un paciente de otro tenant', async () => {
    const p = await new PatientRepository(db, ctxA).create(adultFemale);
    const res = await new HistoryRepository(db, ctxB).setEntry({
      patientId: p.id,
      section: 'heredofamiliares',
      code: 'diabetes',
      value: 'intruso',
    });
    expect(res).toBeNull();
    expect(await new HistoryRepository(db, ctxB).listForPatient(p.id)).toHaveLength(0);
    expect(await new HistoryRepository(db, ctxA).listForPatient(p.id)).toHaveLength(0);
  });
});
