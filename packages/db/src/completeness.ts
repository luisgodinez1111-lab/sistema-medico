/**
 * Completitud del expediente (Release R4). Score DETERMINISTA y VERSIONADO
 * (gobernanza de contenido, §33 #8) calculado a partir de datos ya existentes
 * (sin tabla nueva). Señala qué falta para un expediente mínimo de calidad.
 * No reemplaza el juicio clínico; es una ayuda de completitud (§27: no colapsar
 * ausencia de dato con negativo — "no evaluado" cuenta como faltante, no como OK).
 */

export const COMPLETENESS_RULESET_VERSION = '2026.09.1';

export interface CompletenessInput {
  /** Estado de alergias documentado (revisado o con alergias), no "no evaluado". */
  allergiesAssessed: boolean;
  /** Al menos un ítem de historia clínica capturado. */
  historyCaptured: boolean;
  /** Al menos un signo vital registrado. */
  hasVitals: boolean;
  /** Al menos un contacto/persona relacionada. */
  hasContact: boolean;
  /** Al menos un encuentro clínico registrado. */
  hasEncounter: boolean;
}

export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
}
export interface CompletenessResult {
  score: number; // 0-100
  items: CompletenessItem[];
  rulesetVersion: string;
}

/** Checklist base del expediente mínimo de calidad (pesos iguales). */
export function computeCompleteness(input: CompletenessInput): CompletenessResult {
  const items: CompletenessItem[] = [
    { key: 'allergies', label: 'Alergias evaluadas', done: input.allergiesAssessed },
    { key: 'history', label: 'Historia clínica capturada', done: input.historyCaptured },
    { key: 'vitals', label: 'Signos vitales registrados', done: input.hasVitals },
    { key: 'contact', label: 'Contacto registrado', done: input.hasContact },
    { key: 'encounter', label: 'Encuentro registrado', done: input.hasEncounter },
  ];
  const done = items.filter((i) => i.done).length;
  const score = Math.round((done / items.length) * 100);
  return { score, items, rulesetVersion: COMPLETENESS_RULESET_VERSION };
}
