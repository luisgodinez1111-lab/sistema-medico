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
import { applicablePathways } from './pathways';

describe('specialty-packs (R7)', () => {
  it('todo el contenido está marcado DEMO y versionado', () => {
    expect(SPECIALTY_PACK_SOURCE).toContain('DEMO');
    for (const p of listSpecialtyPacks()) {
      expect(p.source).toBe('demo');
      expect(p.version).toMatch(/^\d{4}\.\d{2}\.\d+$/);
    }
  });

  it('incluye Medicina interna con secciones y quick-picks', () => {
    const pack = getSpecialtyPack('medicina-interna');
    expect(pack?.name).toBe('Medicina interna');
    expect(pack?.extraHistorySections.length).toBeGreaterThan(0);
    expect(pack?.quickProblems.map((q) => q.code)).toContain('diabetes');
  });

  it('incluye packs multi-especialidad reales (interna, gineco, neuro)', () => {
    const ids = listSpecialtyPacks().map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(['medicina-interna', 'ginecologia-obstetricia', 'neurologia']),
    );
    // Ya no hay pack de medicina estética.
    expect(getSpecialtyPack('medicina-estetica')).toBeUndefined();
  });

  it('incluye Dermatología con pathways de vigilancia de nevos', () => {
    const pack = getSpecialtyPack('dermatologia');
    expect(pack?.name).toBe('Dermatología');
    expect(pack?.pathways.some((p) => p.match === 'nevo')).toBe(true);
    expect(listSpecialtyPacks().length).toBeGreaterThanOrEqual(3);
  });

  it('resolveSpecialtyPack cae a la línea base si el id es inválido o nulo', () => {
    expect(resolveSpecialtyPack(null).id).toBe(DEFAULT_SPECIALTY_PACK_ID);
    expect(resolveSpecialtyPack('no-existe').id).toBe(DEFAULT_SPECIALTY_PACK_ID);
  });

  it('mergeHistorySections AÑADE las del pack sin duplicar ni quitar base', () => {
    const base = applicableHistorySections({ ageYears: 40, sex: 'female' });
    const pack = resolveSpecialtyPack('medicina-interna');
    const merged = mergeHistorySections(base, pack);

    // No pierde ninguna base.
    for (const s of base) {
      expect(merged.some((m) => m.section === s.section)).toBe(true);
    }
    // Añade la sección de la especialidad.
    expect(merged.some((m) => m.section === 'interna-antecedentes')).toBe(true);
    // Sin duplicados por section.
    const sections = merged.map((m) => m.section);
    expect(new Set(sections).size).toBe(sections.length);
  });

  it('la línea base no añade secciones', () => {
    const base = applicableHistorySections({ ageYears: 30, sex: 'male' });
    const merged = mergeHistorySections(base, resolveSpecialtyPack('medicina-general'));
    expect(merged.length).toBe(base.length);
  });

  it('las pathways del pack se activan por problema activo, junto a las base', () => {
    const pack = resolveSpecialtyPack('neurologia');
    // Problema de la especialidad → guía del pack (epilepsia no está en las base).
    const epi = applicablePathways([{ code: 'Epilepsia' }], pack.pathways);
    expect(epi.some((p) => p.title === 'Epilepsia (DEMO)')).toBe(true);
    // Problema base sigue activando su guía aunque el pack esté presente.
    const dm2 = applicablePathways([{ code: 'diabetes' }], pack.pathways);
    expect(dm2.some((p) => p.match === 'diabetes')).toBe(true);
    // Sin el pack, la guía de especialidad no aparece.
    expect(applicablePathways([{ code: 'Epilepsia' }])).toHaveLength(0);
  });
});
