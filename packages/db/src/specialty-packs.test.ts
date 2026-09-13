import { describe, it, expect } from 'vitest';
import {
  listSpecialtyPacks,
  getSpecialtyPack,
  resolveSpecialtyPack,
  mergeHistorySections,
  DEFAULT_SPECIALTY_PACK_ID,
  SPECIALTY_PACK_SOURCE,
} from './specialty-packs';
import { applicableHistorySections } from './clinical-history';

describe('specialty-packs (R7)', () => {
  it('todo el contenido está marcado DEMO y versionado', () => {
    expect(SPECIALTY_PACK_SOURCE).toContain('DEMO');
    for (const p of listSpecialtyPacks()) {
      expect(p.source).toBe('demo');
      expect(p.version).toMatch(/^\d{4}\.\d{2}\.\d+$/);
    }
  });

  it('incluye el piloto Medicina estética con secciones y quick-picks', () => {
    const pack = getSpecialtyPack('medicina-estetica');
    expect(pack?.name).toBe('Medicina estética');
    expect(pack?.extraHistorySections.length).toBeGreaterThan(0);
    expect(pack?.quickProblems.map((q) => q.code)).toContain('melasma');
  });

  it('resolveSpecialtyPack cae a la línea base si el id es inválido o nulo', () => {
    expect(resolveSpecialtyPack(null).id).toBe(DEFAULT_SPECIALTY_PACK_ID);
    expect(resolveSpecialtyPack('no-existe').id).toBe(DEFAULT_SPECIALTY_PACK_ID);
  });

  it('mergeHistorySections AÑADE las del pack sin duplicar ni quitar base', () => {
    const base = applicableHistorySections({ ageYears: 40, sex: 'female' });
    const pack = resolveSpecialtyPack('medicina-estetica');
    const merged = mergeHistorySections(base, pack);

    // No pierde ninguna base.
    for (const s of base) {
      expect(merged.some((m) => m.section === s.section)).toBe(true);
    }
    // Añade la sección estética.
    expect(merged.some((m) => m.section === 'estetica-antecedentes')).toBe(true);
    // Sin duplicados por section.
    const sections = merged.map((m) => m.section);
    expect(new Set(sections).size).toBe(sections.length);
  });

  it('la línea base no añade secciones', () => {
    const base = applicableHistorySections({ ageYears: 30, sex: 'male' });
    const merged = mergeHistorySections(base, resolveSpecialtyPack('medicina-general'));
    expect(merged.length).toBe(base.length);
  });
});
