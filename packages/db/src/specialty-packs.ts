import type { HistorySectionDef } from './clinical-history';

/**
 * Specialty packs (Release R7). Paquetes de contenido clínico POR ESPECIALIDAD
 * que adaptan el expediente: secciones de historia extra, problemas frecuentes,
 * plantillas de observación y order sets.
 *
 * Gobernanza (§33 #8): el contenido es ESTRUCTURADO y VERSIONADO, y aquí va
 * marcado **DEMO** (no validado clínicamente). Se reemplazará por contenido
 * revisado por un clínico manteniendo el mismo contrato. Los packs no ejecutan
 * acciones: alimentan la UI (quick-picks informativos) y el motor de historia;
 * el clínico decide y actúa por los flujos permisados existentes.
 *
 * El piloto es Medicina estética (VELUM Laser). Medicina general es la línea base.
 */

export const SPECIALTY_PACK_SCHEMA_VERSION = '2026.09.1';
export const SPECIALTY_PACK_SOURCE = 'DEMO (no validado clínicamente)';

export interface CodedItem {
  code: string;
  label: string;
}
export interface ObservationTemplate extends CodedItem {
  unit?: string;
}

export interface SpecialtyPack {
  id: string;
  name: string;
  description: string;
  version: string;
  /** Origen del contenido: 'demo' hasta que lo valide un clínico. */
  source: 'demo';
  /** Secciones de historia que el pack AÑADE a las base por edad/sexo (§NIVEL 5). */
  extraHistorySections: ReadonlyArray<HistorySectionDef>;
  /** Diagnósticos/problemas frecuentes (quick-pick informativo). */
  quickProblems: ReadonlyArray<CodedItem>;
  /** Observaciones/mediciones sugeridas para la especialidad. */
  observationTemplates: ReadonlyArray<ObservationTemplate>;
  /** Conjuntos de solicitudes frecuentes (order sets). */
  orderSets: ReadonlyArray<CodedItem>;
}

/** Línea base: sin secciones ni quick-picks específicos. */
const MEDICINA_GENERAL: SpecialtyPack = {
  id: 'medicina-general',
  name: 'Medicina general',
  description: 'Línea base sin contenido de especialidad.',
  version: SPECIALTY_PACK_SCHEMA_VERSION,
  source: 'demo',
  extraHistorySections: [],
  quickProblems: [],
  observationTemplates: [
    { code: 'peso', label: 'Peso', unit: 'kg' },
    { code: 'talla', label: 'Talla', unit: 'cm' },
    { code: 'ta', label: 'Tensión arterial', unit: 'mmHg' },
  ],
  orderSets: [],
};

/** Piloto: Medicina estética (VELUM Laser). Contenido DEMO. */
const MEDICINA_ESTETICA: SpecialtyPack = {
  id: 'medicina-estetica',
  name: 'Medicina estética',
  description: 'Piloto VELUM Laser. Fototipo, exposición solar y valoración facial.',
  version: SPECIALTY_PACK_SCHEMA_VERSION,
  source: 'demo',
  extraHistorySections: [
    {
      section: 'estetica-antecedentes',
      title: 'Antecedentes estéticos (DEMO)',
      items: [
        { code: 'fototipo-fitzpatrick', label: 'Fototipo Fitzpatrick (I–VI)' },
        { code: 'exposicion-solar', label: 'Exposición solar habitual' },
        { code: 'tratamientos-previos', label: 'Tratamientos estéticos previos' },
        { code: 'cicatrizacion', label: 'Antecedente de cicatrización queloide' },
        { code: 'expectativas', label: 'Expectativas del paciente' },
      ],
    },
  ],
  quickProblems: [
    { code: 'acne', label: 'Acné' },
    { code: 'melasma', label: 'Melasma' },
    { code: 'rosacea', label: 'Rosácea' },
    { code: 'fotoenvejecimiento', label: 'Fotoenvejecimiento' },
    { code: 'cicatrices', label: 'Cicatrices' },
  ],
  observationTemplates: [
    { code: 'peso', label: 'Peso', unit: 'kg' },
    { code: 'fototipo', label: 'Fototipo Fitzpatrick' },
    { code: 'area-tratada', label: 'Área a tratar' },
  ],
  orderSets: [
    { code: 'valoracion-facial', label: 'Valoración facial' },
    { code: 'consentimiento-laser', label: 'Consentimiento informado (láser)' },
    { code: 'foto-clinica', label: 'Fotografía clínica (antes/después)' },
  ],
};

const PACKS: ReadonlyArray<SpecialtyPack> = [MEDICINA_GENERAL, MEDICINA_ESTETICA];
const PACK_BY_ID = new Map(PACKS.map((p) => [p.id, p]));

/** Id del pack por defecto cuando el tenant no ha elegido especialidad. */
export const DEFAULT_SPECIALTY_PACK_ID = MEDICINA_GENERAL.id;

export function listSpecialtyPacks(): ReadonlyArray<SpecialtyPack> {
  return PACKS;
}

export function getSpecialtyPack(id: string | null | undefined): SpecialtyPack | undefined {
  if (!id) return undefined;
  return PACK_BY_ID.get(id);
}

/** Devuelve el pack activo del tenant, o la línea base si no hay/ no es válido. */
export function resolveSpecialtyPack(id: string | null | undefined): SpecialtyPack {
  return getSpecialtyPack(id) ?? MEDICINA_GENERAL;
}

/**
 * Combina las secciones base (por edad/sexo) con las del pack activo, sin
 * duplicar por `section`. El pack sólo AÑADE; nunca quita secciones obligatorias.
 */
export function mergeHistorySections(
  base: ReadonlyArray<HistorySectionDef>,
  pack: SpecialtyPack,
): HistorySectionDef[] {
  const seen = new Set(base.map((s) => s.section));
  const extra = pack.extraHistorySections.filter((s) => !seen.has(s.section));
  return [...base, ...extra];
}
