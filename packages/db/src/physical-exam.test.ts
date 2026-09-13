import { describe, it, expect } from 'vitest';
import {
  EXAM_SECTIONS,
  composeExamObjective,
  examSectionTitle,
  PHYSICAL_EXAM_VERSION,
} from './physical-exam';

describe('physical-exam engine (§28 paso 6)', () => {
  it('está versionado y cubre los aparatos y sistemas base', () => {
    expect(PHYSICAL_EXAM_VERSION).toMatch(/^\d{4}\.\d{2}\.\d+$/);
    const sections = EXAM_SECTIONS.map((s) => s.section);
    expect(sections).toContain('torax-cardiopulmonar');
    expect(sections).toContain('abdomen');
    expect(sections).toContain('neurologico');
  });

  it('composeExamObjective deriva un Objetivo legible en orden canónico', () => {
    const text = composeExamObjective([
      { section: 'abdomen', normal: false, note: 'dolor en fosa iliaca derecha' },
      { section: 'habitus', normal: true },
    ]);
    // Orden canónico: habitus antes que abdomen.
    expect(text.indexOf('Habitus')).toBeLessThan(text.indexOf('Abdomen'));
    expect(text).toContain('Habitus exterior: sin alteraciones');
    expect(text).toContain('Abdomen: dolor en fosa iliaca derecha');
  });

  it('anormal sin nota usa un marcador explícito', () => {
    expect(composeExamObjective([{ section: 'piel-tegumentos', normal: false }])).toContain(
      'hallazgos no especificados',
    );
  });

  it('sin hallazgos devuelve cadena vacía', () => {
    expect(composeExamObjective([])).toBe('');
  });

  it('examSectionTitle resuelve el título', () => {
    expect(examSectionTitle('neurologico')).toBe('Neurológico');
  });
});
