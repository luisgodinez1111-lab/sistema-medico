import type { HistorySectionDef } from './clinical-history';
import type { PathwayDef } from './pathways';

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
 * Medical OS es un sistema médico GENERAL y multi-especialidad: Medicina general
 * es la línea base y cada especialidad (interna, gineco-obstetricia, neurología,
 * dermatología, …) aporta su propio pack. El catálogo es extensible.
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
  /** Guías de manejo propias de la especialidad (se filtran por problema activo). */
  pathways: ReadonlyArray<PathwayDef>;
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
  pathways: [],
};

/** Medicina interna. Contenido DEMO. */
const MEDICINA_INTERNA: SpecialtyPack = {
  id: 'medicina-interna',
  name: 'Medicina interna',
  description: 'Enfermedades crónicas del adulto: control metabólico, cardiovascular y renal.',
  version: SPECIALTY_PACK_SCHEMA_VERSION,
  source: 'demo',
  extraHistorySections: [
    {
      section: 'interna-antecedentes',
      title: 'Antecedentes de medicina interna (DEMO)',
      items: [
        { code: 'apego-tratamiento', label: 'Apego al tratamiento' },
        { code: 'hospitalizaciones-previas', label: 'Hospitalizaciones previas' },
        { code: 'polifarmacia', label: 'Polifarmacia' },
        { code: 'tamiz-cardiovascular', label: 'Riesgo cardiovascular' },
      ],
    },
  ],
  quickProblems: [
    { code: 'diabetes', label: 'Diabetes mellitus tipo 2' },
    { code: 'hipertension', label: 'Hipertensión arterial' },
    { code: 'dislipidemia', label: 'Dislipidemia' },
    { code: 'erc', label: 'Enfermedad renal crónica' },
    { code: 'hipotiroidismo', label: 'Hipotiroidismo' },
  ],
  observationTemplates: [
    { code: 'peso', label: 'Peso', unit: 'kg' },
    { code: 'talla', label: 'Talla', unit: 'cm' },
    { code: 'imc', label: 'IMC', unit: 'kg/m²' },
    { code: 'ta', label: 'Tensión arterial', unit: 'mmHg' },
    { code: 'glucosa', label: 'Glucosa capilar', unit: 'mg/dL' },
  ],
  orderSets: [
    { code: 'hba1c', label: 'Hemoglobina glucosilada (HbA1c)' },
    { code: 'perfil-lipidico', label: 'Perfil de lípidos' },
    { code: 'quimica-sanguinea', label: 'Química sanguínea' },
    { code: 'ego', label: 'Examen general de orina' },
  ],
  pathways: [
    {
      match: 'diabetes',
      title: 'Diabetes mellitus tipo 2 (DEMO)',
      items: [
        { label: 'HbA1c', cadence: 'cada 3 meses' },
        { label: 'Perfil lipídico', cadence: 'anual' },
        { label: 'Examen de pies y fondo de ojo', cadence: 'anual' },
      ],
    },
    {
      match: 'hipertension',
      title: 'Hipertensión arterial (DEMO)',
      items: [
        { label: 'Tensión arterial', cadence: 'cada visita' },
        { label: 'Creatinina y electrolitos', cadence: 'anual' },
      ],
    },
  ],
};

/** Ginecología y obstetricia. Contenido DEMO. */
const GINECOLOGIA_OBSTETRICIA: SpecialtyPack = {
  id: 'ginecologia-obstetricia',
  name: 'Ginecología y obstetricia',
  description: 'Salud de la mujer: control ginecológico, tamizajes y control prenatal.',
  version: SPECIALTY_PACK_SCHEMA_VERSION,
  source: 'demo',
  extraHistorySections: [
    {
      section: 'gineco-obstetricos-especialidad',
      title: 'Antecedentes gineco-obstétricos (DEMO)',
      items: [
        { code: 'menarca', label: 'Menarca (edad)' },
        { code: 'fum', label: 'Fecha de última menstruación' },
        { code: 'gestas-partos-cesareas', label: 'Gestas / partos / cesáreas / abortos' },
        { code: 'metodo-anticonceptivo', label: 'Método anticonceptivo' },
        { code: 'ultimo-papanicolaou', label: 'Último Papanicolaou' },
      ],
    },
  ],
  quickProblems: [
    { code: 'embarazo', label: 'Embarazo' },
    { code: 'sangrado-uterino-anormal', label: 'Sangrado uterino anormal' },
    { code: 'sindrome-ovario-poliquistico', label: 'Síndrome de ovario poliquístico' },
    { code: 'infeccion-vaginal', label: 'Infección vaginal' },
    { code: 'climaterio', label: 'Climaterio / menopausia' },
  ],
  observationTemplates: [
    { code: 'peso', label: 'Peso', unit: 'kg' },
    { code: 'ta', label: 'Tensión arterial', unit: 'mmHg' },
    { code: 'altura-uterina', label: 'Altura uterina', unit: 'cm' },
    { code: 'fcf', label: 'Frecuencia cardiaca fetal', unit: 'lpm' },
  ],
  orderSets: [
    { code: 'papanicolaou', label: 'Papanicolaou' },
    { code: 'ultrasonido-pelvico', label: 'Ultrasonido pélvico' },
    { code: 'ultrasonido-obstetrico', label: 'Ultrasonido obstétrico' },
    { code: 'perfil-prenatal', label: 'Perfil prenatal (BH, glucosa, grupo y Rh, VDRL, VIH)' },
  ],
  pathways: [
    {
      match: 'embarazo',
      title: 'Control prenatal (DEMO)',
      items: [
        { label: 'Tensión arterial y peso', cadence: 'cada consulta' },
        { label: 'Altura uterina y FCF', cadence: 'cada consulta (según edad gestacional)' },
        { label: 'Ultrasonido obstétrico', cadence: 'por trimestre' },
      ],
    },
  ],
};

/** Neurología. Contenido DEMO. */
const NEUROLOGIA: SpecialtyPack = {
  id: 'neurologia',
  name: 'Neurología',
  description: 'Exploración neurológica, cefaleas, epilepsia y enfermedad cerebrovascular.',
  version: SPECIALTY_PACK_SCHEMA_VERSION,
  source: 'demo',
  extraHistorySections: [
    {
      section: 'neurologia-antecedentes',
      title: 'Antecedentes neurológicos (DEMO)',
      items: [
        { code: 'crisis-convulsivas', label: 'Crisis convulsivas' },
        { code: 'cefalea-patron', label: 'Patrón de cefalea' },
        { code: 'evc-previo', label: 'EVC / isquemia previa' },
        { code: 'deterioro-cognitivo', label: 'Deterioro cognitivo' },
        { code: 'trauma-craneo', label: 'Traumatismo craneoencefálico' },
      ],
    },
  ],
  quickProblems: [
    { code: 'cefalea', label: 'Cefalea' },
    { code: 'migrana', label: 'Migraña' },
    { code: 'epilepsia', label: 'Epilepsia' },
    { code: 'evc', label: 'Enfermedad vascular cerebral' },
    { code: 'neuropatia', label: 'Neuropatía periférica' },
  ],
  observationTemplates: [
    { code: 'ta', label: 'Tensión arterial', unit: 'mmHg' },
    { code: 'glasgow', label: 'Escala de Glasgow', unit: 'pts' },
    { code: 'fuerza-muscular', label: 'Fuerza muscular (0–5)' },
    { code: 'nihss', label: 'Escala NIHSS', unit: 'pts' },
  ],
  orderSets: [
    { code: 'resonancia-craneo', label: 'Resonancia magnética de cráneo' },
    { code: 'tac-craneo', label: 'Tomografía de cráneo' },
    { code: 'electroencefalograma', label: 'Electroencefalograma (EEG)' },
    { code: 'electromiografia', label: 'Electromiografía' },
  ],
  pathways: [
    {
      match: 'epilepsia',
      title: 'Epilepsia (DEMO)',
      items: [
        { label: 'Recuento de crisis y apego', cadence: 'cada consulta' },
        { label: 'Niveles séricos del antiepiléptico (si aplica)', cadence: 'según fármaco' },
      ],
    },
    {
      match: 'migrana',
      title: 'Migraña (DEMO)',
      items: [{ label: 'Diario de cefalea (frecuencia/intensidad)', cadence: 'continuo' }],
    },
  ],
};

/** Dermatología. Contenido DEMO. */
const DERMATOLOGIA: SpecialtyPack = {
  id: 'dermatologia',
  name: 'Dermatología',
  description: 'Lesiones cutáneas, fototipo y seguimiento dermatoscópico.',
  version: SPECIALTY_PACK_SCHEMA_VERSION,
  source: 'demo',
  extraHistorySections: [
    {
      section: 'dermatologia-antecedentes',
      title: 'Antecedentes dermatológicos (DEMO)',
      items: [
        { code: 'fototipo-fitzpatrick', label: 'Fototipo Fitzpatrick (I–VI)' },
        { code: 'cancer-piel-familiar', label: 'Antecedente familiar de cáncer de piel' },
        { code: 'nevos-atipicos', label: 'Nevos atípicos' },
        { code: 'fotoexposicion', label: 'Fotoexposición ocupacional/recreativa' },
      ],
    },
  ],
  quickProblems: [
    { code: 'dermatitis-atopica', label: 'Dermatitis atópica' },
    { code: 'psoriasis', label: 'Psoriasis' },
    { code: 'acne', label: 'Acné' },
    { code: 'nevo-melanocitico', label: 'Nevo melanocítico' },
    { code: 'dermatitis-contacto', label: 'Dermatitis de contacto' },
  ],
  observationTemplates: [
    { code: 'peso', label: 'Peso', unit: 'kg' },
    { code: 'fototipo', label: 'Fototipo Fitzpatrick' },
    { code: 'localizacion-lesion', label: 'Localización de la lesión' },
    { code: 'diametro-lesion', label: 'Diámetro de la lesión', unit: 'mm' },
  ],
  orderSets: [
    { code: 'dermatoscopia', label: 'Dermatoscopia' },
    { code: 'biopsia-piel', label: 'Biopsia de piel' },
    { code: 'foto-clinica', label: 'Fotografía clínica (seguimiento)' },
  ],
  pathways: [
    {
      match: 'nevo',
      title: 'Vigilancia de nevos (DEMO)',
      items: [
        { label: 'Control dermatoscópico (regla ABCDE)', cadence: 'cada 6-12 meses' },
        { label: 'Fotografía clínica comparativa', cadence: 'cada 6-12 meses' },
      ],
    },
    {
      match: 'psoriasis',
      title: 'Psoriasis (DEMO)',
      items: [{ label: 'Evaluación de superficie afectada (BSA/PASI)', cadence: 'cada visita' }],
    },
  ],
};

const PACKS: ReadonlyArray<SpecialtyPack> = [
  MEDICINA_GENERAL,
  MEDICINA_INTERNA,
  GINECOLOGIA_OBSTETRICIA,
  NEUROLOGIA,
  DERMATOLOGIA,
];
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
