import { describe, it, expect } from 'vitest';
import { applicablePathways, PATHWAYS_VERSION } from './pathways';

describe('applicablePathways (R4, DEMO)', () => {
  it('activa la guía por coincidencia de problema (acentos/mayúsculas)', () => {
    const p = applicablePathways([
      { code: 'Diabetes mellitus tipo 2' },
      { code: 'Hipertensión arterial' },
    ]);
    expect(p.map((x) => x.match).sort()).toEqual(['diabetes', 'hipertension']);
    expect(PATHWAYS_VERSION).toContain('demo');
  });

  it('sin problemas coincidentes → sin guías', () => {
    expect(applicablePathways([{ code: 'Migraña' }])).toHaveLength(0);
    expect(applicablePathways([])).toHaveLength(0);
  });

  it('la guía DM2 incluye HbA1c', () => {
    const [dm2] = applicablePathways([{ code: 'diabetes' }]);
    expect(dm2!.items.some((i) => i.label === 'HbA1c')).toBe(true);
  });
});
