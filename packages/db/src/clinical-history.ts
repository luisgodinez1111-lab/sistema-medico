/**
 * Motor de Historia Clínica Adaptativa (§NIVEL 5).
 *
 * Define, de forma ESTRUCTURADA y VERSIONADA, qué secciones e ítems aplican
 * según edad y sexo del paciente. No es texto libre ni un JSON gigante (§33 #1):
 * cada ítem se persiste como fila en `history_entry`. La versión permite
 * gobernanza del contenido clínico (§33 #8).
 */

export const HISTORY_SCHEMA_VERSION = '2026.09.1';

export interface HistoryItemDef {
  code: string;
  label: string;
}
export interface HistorySectionDef {
  section: string;
  title: string;
  items: ReadonlyArray<HistoryItemDef>;
}

const HEREDOFAMILIARES: HistorySectionDef = {
  section: 'heredofamiliares',
  title: 'Antecedentes heredofamiliares',
  items: [
    { code: 'diabetes', label: 'Diabetes' },
    { code: 'hipertension', label: 'Hipertensión' },
    { code: 'cardiopatia', label: 'Cardiopatía' },
    { code: 'cancer', label: 'Cáncer' },
    { code: 'otros', label: 'Otros' },
  ],
};

const PERSONALES_PATOLOGICOS: HistorySectionDef = {
  section: 'personales-patologicos',
  title: 'Antecedentes personales patológicos',
  items: [
    { code: 'cronicos', label: 'Enfermedades crónicas' },
    { code: 'cirugias', label: 'Cirugías' },
    { code: 'hospitalizaciones', label: 'Hospitalizaciones' },
    { code: 'transfusiones', label: 'Transfusiones' },
  ],
};

const PERSONALES_NO_PATOLOGICOS: HistorySectionDef = {
  section: 'personales-no-patologicos',
  title: 'Antecedentes personales no patológicos',
  items: [
    { code: 'tabaquismo', label: 'Tabaquismo' },
    { code: 'alcoholismo', label: 'Alcoholismo' },
    { code: 'toxicomanias', label: 'Toxicomanías' },
    { code: 'actividad-fisica', label: 'Actividad física' },
  ],
};

const GINECO_OBSTETRICOS: HistorySectionDef = {
  section: 'gineco-obstetricos',
  title: 'Antecedentes gineco-obstétricos',
  items: [
    { code: 'menarca', label: 'Menarca (edad)' },
    { code: 'fum', label: 'Fecha de última menstruación' },
    { code: 'gestas', label: 'Gestas' },
    { code: 'partos', label: 'Partos' },
    { code: 'cesareas', label: 'Cesáreas' },
    { code: 'metodo-anticonceptivo', label: 'Método anticonceptivo' },
  ],
};

const PERINATALES: HistorySectionDef = {
  section: 'perinatales',
  title: 'Antecedentes perinatales',
  items: [
    { code: 'tipo-parto', label: 'Tipo de parto' },
    { code: 'semanas-gestacion', label: 'Semanas de gestación' },
    { code: 'peso-nacer', label: 'Peso al nacer' },
    { code: 'apgar', label: 'APGAR' },
    { code: 'complicaciones', label: 'Complicaciones' },
  ],
};

const DESARROLLO: HistorySectionDef = {
  section: 'desarrollo',
  title: 'Desarrollo psicomotor',
  items: [
    { code: 'sosten-cefalico', label: 'Sostén cefálico' },
    { code: 'sedestacion', label: 'Sedestación' },
    { code: 'marcha', label: 'Marcha' },
    { code: 'lenguaje', label: 'Lenguaje' },
  ],
};

const INMUNIZACIONES: HistorySectionDef = {
  section: 'inmunizaciones',
  title: 'Inmunizaciones',
  items: [
    { code: 'esquema-completo', label: 'Esquema completo para la edad' },
    { code: 'observaciones', label: 'Observaciones' },
  ],
};

/** Umbral pediátrico (años). */
export const PEDIATRIC_AGE_MAX = 12;
const EARLY_DEVELOPMENT_AGE_MAX = 5;

/**
 * Secciones aplicables según edad/sexo. Adultos y pediátricos comparten
 * heredofamiliares; el resto se adapta (gineco sólo en mujer adulta; perinatales,
 * desarrollo e inmunizaciones en pediátricos).
 */
export function applicableHistorySections(params: {
  ageYears: number;
  sex: string;
}): HistorySectionDef[] {
  const { ageYears, sex } = params;
  const isPediatric = ageYears < PEDIATRIC_AGE_MAX;

  if (isPediatric) {
    const sections = [HEREDOFAMILIARES, PERINATALES];
    if (ageYears < EARLY_DEVELOPMENT_AGE_MAX) sections.push(DESARROLLO);
    sections.push(INMUNIZACIONES);
    return sections;
  }

  const sections = [HEREDOFAMILIARES, PERSONALES_PATOLOGICOS, PERSONALES_NO_PATOLOGICOS];
  if (sex === 'female') sections.push(GINECO_OBSTETRICOS);
  return sections;
}
