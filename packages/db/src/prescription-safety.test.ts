import { describe, it, expect } from 'vitest';
import { checkPrescription, hasCritical } from './prescription-safety';

describe('checkPrescription — dosis por peso/edad (§NIVEL 8)', () => {
  const base = { allergies: [], activeMedications: [] } as const;

  it('sugiere rango de dosis pediátrica por peso (info, DEMO)', () => {
    const alerts = checkPrescription({
      ...base,
      drug: 'Paracetamol',
      ageYears: 5,
      weightKg: 20,
    });
    const dose = alerts.find((a) => a.code === 'weight-based-dose');
    expect(dose?.severity).toBe('info');
    expect(dose?.source).toBe('demo');
    // 10–15 mg/kg × 20 kg = 200–300 mg.
    expect(dose?.message).toContain('200–300 mg');
    expect(hasCritical(alerts)).toBe(false);
  });

  it('advierte si el paciente pediátrico no tiene peso registrado', () => {
    const alerts = checkPrescription({ ...base, drug: 'Ibuprofeno', ageYears: 3 });
    const miss = alerts.find((a) => a.code === 'missing-weight');
    expect(miss?.severity).toBe('warning');
    expect(miss?.source).toBe('rule');
  });

  it('NO aplica dosis pediátrica a adultos', () => {
    const alerts = checkPrescription({
      ...base,
      drug: 'Paracetamol',
      ageYears: 40,
      weightKg: 70,
    });
    expect(alerts.some((a) => a.code === 'weight-based-dose')).toBe(false);
    expect(alerts.some((a) => a.code === 'missing-weight')).toBe(false);
  });

  it('sin fármaco del catálogo, no genera alerta de dosis', () => {
    const alerts = checkPrescription({
      ...base,
      drug: 'Loratadina',
      ageYears: 5,
      weightKg: 20,
    });
    expect(alerts.some((a) => a.code === 'weight-based-dose')).toBe(false);
  });

  it('sigue detectando alergia crítica (regla determinista) con o sin dosis', () => {
    const alerts = checkPrescription({
      drug: 'Paracetamol',
      allergies: [{ substance: 'Paracetamol' }],
      activeMedications: [],
      ageYears: 5,
      weightKg: 20,
    });
    expect(hasCritical(alerts)).toBe(true);
    expect(alerts.some((a) => a.code === 'allergy-contraindication')).toBe(true);
  });
});
