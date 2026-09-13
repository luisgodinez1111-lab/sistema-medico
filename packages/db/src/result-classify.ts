/**
 * Clasificación de resultados de laboratorio (§NIVEL 9). Deriva la bandera de
 * anormalidad de un valor numérico contra su rango de referencia, en lugar de
 * depender de que alguien la marque a mano (§27: un resultado anormal no debe
 * pasar desapercibido). Determinista, no DEMO: es aritmética, no contenido
 * clínico opinable (el rango de referencia lo aporta el laboratorio/orden).
 */

type AbnormalFlag = 'normal' | 'low' | 'high' | 'critical';

/** Parsea un número tolerando coma decimal; undefined si no es numérico. */
function num(v: string | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = parseFloat(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Clasifica un resultado contra su rango de referencia. Devuelve:
 * - 'low'/'high' si el valor numérico cae fuera del rango,
 * - 'normal' si cae dentro,
 * - undefined si no hay suficiente información numérica (valor o límites no
 *   numéricos) — en ese caso NO se autoclasifica y se respeta la bandera manual.
 */
export function classifyResult(input: {
  value: string;
  referenceLow?: string | null;
  referenceHigh?: string | null;
}): Exclude<AbnormalFlag, 'critical'> | undefined {
  const v = num(input.value);
  const low = num(input.referenceLow);
  const high = num(input.referenceHigh);
  if (v === undefined) return undefined;
  if (low === undefined && high === undefined) return undefined;

  if (low !== undefined && v < low) return 'low';
  if (high !== undefined && v > high) return 'high';
  return 'normal';
}

/** Formatea el rango de referencia para mostrar, o '' si no hay. */
export function formatReferenceRange(
  referenceLow?: string | null,
  referenceHigh?: string | null,
): string {
  const low = (referenceLow ?? '').trim();
  const high = (referenceHigh ?? '').trim();
  if (low && high) return `${low}–${high}`;
  if (low) return `≥ ${low}`;
  if (high) return `≤ ${high}`;
  return '';
}
