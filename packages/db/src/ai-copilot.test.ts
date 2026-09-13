import { describe, it, expect } from 'vitest';
import { generateSuggestions, AI_POLICY_VERSION, AI_ENGINE } from './ai-copilot';

describe('AI Copilot stub (R6)', () => {
  it('sugiere HbA1c ante diabetes y marca engine/policy DEMO', () => {
    const r = generateSuggestions({
      conditions: [{ code: 'Diabetes mellitus tipo 2' }],
      allergies: [],
    });
    expect(r.suggestions.some((s) => s.code === 'dm2-hba1c')).toBe(true);
    expect(r.engine).toBe(AI_ENGINE);
    expect(r.policyVersion).toBe(AI_POLICY_VERSION);
    expect(r.contextHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sugiere precaución ante alergia de alto riesgo', () => {
    const r = generateSuggestions({
      conditions: [],
      allergies: [{ substance: 'Penicilina', criticality: 'high' }],
    });
    const s = r.suggestions.find((x) => x.code.startsWith('allergy-'));
    expect(s).toBeTruthy();
    expect(s!.severity).toBe('warning');
  });

  it('sin contexto relevante → sin sugerencias, pero con hash estable', () => {
    const a = generateSuggestions({ conditions: [], allergies: [] });
    const b = generateSuggestions({ conditions: [], allergies: [] });
    expect(a.suggestions).toHaveLength(0);
    expect(a.contextHash).toBe(b.contextHash);
  });

  it('el hash no depende del orden de los problemas', () => {
    const a = generateSuggestions({
      conditions: [{ code: 'Diabetes' }, { code: 'Hipertensión' }],
      allergies: [],
    });
    const b = generateSuggestions({
      conditions: [{ code: 'Hipertensión' }, { code: 'Diabetes' }],
      allergies: [],
    });
    expect(a.contextHash).toBe(b.contextHash);
  });
});
