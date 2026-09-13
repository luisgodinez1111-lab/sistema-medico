/**
 * Derivación de partes ESTRUCTURADAS de la nota SOAP (§NIVEL 6, §28 paso 7).
 * Igual que la exploración deriva el Objetivo, los diagnósticos del encuentro
 * derivan el Análisis (A), para que la firma + hash cubran esa parte.
 */

/**
 * Deriva el texto del Análisis (A) a partir de los diagnósticos del encuentro.
 * Devuelve '' si no hay diagnósticos.
 */
export function composeAssessment(diagnoses: ReadonlyArray<{ code: string }>): string {
  const codes = diagnoses.map((d) => d.code.trim()).filter(Boolean);
  if (codes.length === 0) return '';
  return `Diagnósticos:\n${codes.map((c) => `- ${c}`).join('\n')}`;
}
