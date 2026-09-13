/**
 * Exploración física estructurada (§NIVEL 6, §28 paso 6). Por aparatos y
 * sistemas, ESTRUCTURADA (no un textarea libre; §33 #1) y VERSIONADA. Cada
 * hallazgo se persiste como fila por (encuentro, sección); de esas filas se
 * deriva el "Objetivo (O)" de la nota SOAP, de modo que la firma + hash del
 * encuentro cubren la exploración sin un flujo aparte.
 */

export const PHYSICAL_EXAM_VERSION = '2026.09.1';

export interface ExamSectionDef {
  section: string;
  title: string;
}

/** Aparatos y sistemas de la exploración física (orden de cabeza a pies). */
export const EXAM_SECTIONS: ReadonlyArray<ExamSectionDef> = [
  { section: 'habitus', title: 'Habitus exterior' },
  { section: 'cabeza-cuello', title: 'Cabeza y cuello' },
  { section: 'torax-cardiopulmonar', title: 'Tórax (cardiopulmonar)' },
  { section: 'abdomen', title: 'Abdomen' },
  { section: 'extremidades', title: 'Extremidades' },
  { section: 'neurologico', title: 'Neurológico' },
  { section: 'piel-tegumentos', title: 'Piel y tegumentos' },
];

const TITLE_BY_SECTION = new Map(EXAM_SECTIONS.map((s) => [s.section, s.title]));

export function examSectionTitle(section: string): string {
  return TITLE_BY_SECTION.get(section) ?? section;
}

export interface ExamFinding {
  section: string;
  normal: boolean;
  note?: string | null;
}

/**
 * Deriva el texto del Objetivo (O) a partir de los hallazgos estructurados.
 * Sólo incluye secciones exploradas (con fila). Normal → "sin alteraciones";
 * anormal → la nota (o "hallazgos no especificados"). Orden canónico por
 * `EXAM_SECTIONS`. Devuelve '' si no hay hallazgos.
 */
export function composeExamObjective(findings: ReadonlyArray<ExamFinding>): string {
  const bySection = new Map(findings.map((f) => [f.section, f]));
  const lines: string[] = [];
  for (const s of EXAM_SECTIONS) {
    const f = bySection.get(s.section);
    if (!f) continue;
    if (f.normal) {
      lines.push(`${s.title}: sin alteraciones`);
    } else {
      const note = (f.note ?? '').trim();
      lines.push(`${s.title}: ${note || 'hallazgos no especificados'}`);
    }
  }
  if (lines.length === 0) return '';
  return `Exploración física:\n${lines.join('\n')}`;
}
