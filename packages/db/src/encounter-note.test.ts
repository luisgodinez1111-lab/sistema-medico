import { describe, it, expect } from 'vitest';
import { composeAssessment } from './encounter-note';

describe('composeAssessment (§28 paso 7)', () => {
  it('lista los diagnósticos del encuentro', () => {
    const a = composeAssessment([{ code: 'Diabetes tipo 2' }, { code: 'Hipertensión' }]);
    expect(a).toContain('Diagnósticos:');
    expect(a).toContain('- Diabetes tipo 2');
    expect(a).toContain('- Hipertensión');
  });

  it('ignora códigos vacíos y devuelve cadena vacía sin diagnósticos', () => {
    expect(composeAssessment([{ code: '  ' }])).toBe('');
    expect(composeAssessment([])).toBe('');
  });
});
