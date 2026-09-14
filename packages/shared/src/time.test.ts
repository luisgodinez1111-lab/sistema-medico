import { describe, it, expect } from 'vitest';
import { preciseAge, addBusinessDays } from './time.js';

describe('addBusinessDays (plazos ARCO §NIVEL 18)', () => {
  it('salta el fin de semana', () => {
    // Viernes 2026-01-02 (UTC) + 1 hábil = lunes 2026-01-05.
    const friday = new Date('2026-01-02T00:00:00Z');
    expect(addBusinessDays(friday, 1).toISOString().slice(0, 10)).toBe('2026-01-05');
  });

  it('20 días hábiles nunca caen en sábado/domingo', () => {
    const due = addBusinessDays(new Date('2026-01-02T00:00:00Z'), 20);
    expect(due.getUTCDay()).not.toBe(0);
    expect(due.getUTCDay()).not.toBe(6);
    // 20 hábiles ≈ 4 semanas naturales (28 días) desde un viernes.
    expect(due.toISOString().slice(0, 10)).toBe('2026-01-30');
  });
});

describe('preciseAge', () => {
  it('calcula años completos', () => {
    const age = preciseAge(new Date('2000-01-15'), new Date('2026-01-15'));
    expect(age.years).toBe(26);
    expect(age.months).toBe(0);
    expect(age.days).toBe(0);
  });

  it('ajusta meses y días cuando aún no cumple años', () => {
    const age = preciseAge(new Date('2000-06-20'), new Date('2026-01-10'));
    expect(age.years).toBe(25);
    expect(age.months).toBe(6);
  });

  it('maneja un neonato en días (perfil neonatal §NIVEL 5)', () => {
    const age = preciseAge(new Date('2026-09-01'), new Date('2026-09-12'));
    expect(age.years).toBe(0);
    expect(age.months).toBe(0);
    expect(age.days).toBe(11);
    expect(age.totalDays).toBe(11);
  });
});
