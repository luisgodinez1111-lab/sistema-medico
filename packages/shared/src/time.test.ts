import { describe, it, expect } from 'vitest';
import { preciseAge } from './time.js';

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
