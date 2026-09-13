import { describe, it, expect } from 'vitest';
import { computeCompleteness, COMPLETENESS_RULESET_VERSION } from './completeness';

describe('computeCompleteness (R4)', () => {
  it('expediente vacío = 0 y todos los ítems pendientes', () => {
    const r = computeCompleteness({
      allergiesAssessed: false,
      historyCaptured: false,
      hasVitals: false,
      hasContact: false,
      hasEncounter: false,
    });
    expect(r.score).toBe(0);
    expect(r.items.every((i) => !i.done)).toBe(true);
    expect(r.rulesetVersion).toBe(COMPLETENESS_RULESET_VERSION);
  });

  it('expediente completo = 100', () => {
    const r = computeCompleteness({
      allergiesAssessed: true,
      historyCaptured: true,
      hasVitals: true,
      hasContact: true,
      hasEncounter: true,
    });
    expect(r.score).toBe(100);
  });

  it('parcial: 2 de 5 = 40', () => {
    const r = computeCompleteness({
      allergiesAssessed: true,
      historyCaptured: false,
      hasVitals: true,
      hasContact: false,
      hasEncounter: false,
    });
    expect(r.score).toBe(40);
    expect(r.items.find((i) => i.key === 'allergies')!.done).toBe(true);
    expect(r.items.find((i) => i.key === 'history')!.done).toBe(false);
  });
});
