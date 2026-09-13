import { describe, it, expect } from 'vitest';
import { classifyResult, formatReferenceRange } from './result-classify';

describe('classifyResult (§NIVEL 9)', () => {
  it('marca bajo/alto/normal contra el rango', () => {
    expect(classifyResult({ value: '9.1', referenceLow: '12', referenceHigh: '16' })).toBe('low');
    expect(classifyResult({ value: '18', referenceLow: '12', referenceHigh: '16' })).toBe('high');
    expect(classifyResult({ value: '14', referenceLow: '12', referenceHigh: '16' })).toBe('normal');
  });

  it('tolera coma decimal y límites abiertos', () => {
    expect(classifyResult({ value: '9,1', referenceLow: '12' })).toBe('low');
    expect(classifyResult({ value: '5', referenceHigh: '4' })).toBe('high');
  });

  it('devuelve undefined si no hay datos numéricos suficientes (respeta manual)', () => {
    expect(
      classifyResult({ value: 'positivo', referenceLow: '1', referenceHigh: '2' }),
    ).toBeUndefined();
    expect(classifyResult({ value: '9.1' })).toBeUndefined();
  });

  it('formatReferenceRange da rango legible', () => {
    expect(formatReferenceRange('12', '16')).toBe('12–16');
    expect(formatReferenceRange('12', null)).toBe('≥ 12');
    expect(formatReferenceRange(null, '16')).toBe('≤ 16');
    expect(formatReferenceRange(null, null)).toBe('');
  });
});
