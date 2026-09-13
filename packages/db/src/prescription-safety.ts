/**
 * Motor de seguridad de prescripción (§NIVEL 8).
 *
 * Las alertas clínicas son ESTRUCTURADAS y VERSIONADAS, nunca JSX ad-hoc sin
 * gobernanza (§33 #8). Cada alerta lleva código, severidad y la versión del
 * ruleset con que se generó, para trazabilidad y revisión clínica.
 */

export const SAFETY_RULESET_VERSION = '2026.09.1';

/**
 * Catálogo de interacciones fármaco-fármaco. **CONTENIDO DEMO, NO VALIDADO
 * CLÍNICAMENTE** (§33 #8: el contenido clínico real requiere fuente + versión +
 * reviewer). Sustituir por una base licenciada antes de uso real.
 */
export const INTERACTIONS_DATASET_VERSION = 'demo-2026.09.1';
export const INTERACTIONS_SOURCE = 'DEMO (no validado clínicamente)';

interface InteractionRule {
  a: string;
  b: string;
  severity: SafetySeverity;
  note: string;
}
const DEMO_INTERACTIONS: ReadonlyArray<InteractionRule> = [
  { a: 'warfarina', b: 'ibuprofeno', severity: 'critical', note: 'riesgo de sangrado (DEMO)' },
  { a: 'warfarina', b: 'aspirina', severity: 'critical', note: 'riesgo de sangrado (DEMO)' },
  { a: 'enalapril', b: 'espironolactona', severity: 'warning', note: 'hiperkalemia (DEMO)' },
  { a: 'simvastatina', b: 'claritromicina', severity: 'critical', note: 'rabdomiólisis (DEMO)' },
  { a: 'metformina', b: 'alcohol', severity: 'warning', note: 'acidosis láctica (DEMO)' },
];

/**
 * Catálogo de dosificación pediátrica por peso. **CONTENIDO DEMO, NO VALIDADO
 * CLÍNICAMENTE** (§33 #8). Rangos mg/kg orientativos; sustituir por una fuente
 * licenciada antes de uso real. Es INFORMATIVO (human-in-the-loop): sugiere, no
 * calcula la receta ni decide por el clínico.
 */
export const DOSING_DATASET_VERSION = 'demo-2026.09.1';
export const DOSING_SOURCE = 'DEMO (no validado clínicamente)';

/** Umbral de edad para aplicar verificación de dosis por peso (pediátrico). */
const PEDIATRIC_AGE_MAX = 12;

interface PediatricDoseRule {
  drug: string;
  minPerKg: number;
  maxPerKg: number;
  unit: string;
  per: 'dosis' | 'día';
}
const DEMO_PEDIATRIC_DOSING: ReadonlyArray<PediatricDoseRule> = [
  { drug: 'paracetamol', minPerKg: 10, maxPerKg: 15, unit: 'mg', per: 'dosis' },
  { drug: 'ibuprofeno', minPerKg: 5, maxPerKg: 10, unit: 'mg', per: 'dosis' },
  { drug: 'amoxicilina', minPerKg: 40, maxPerKg: 90, unit: 'mg', per: 'día' },
];

export type SafetyAlertCode =
  | 'allergy-contraindication'
  | 'duplicate-therapy'
  | 'drug-interaction'
  | 'weight-based-dose'
  | 'missing-weight';
export type SafetySeverity = 'critical' | 'warning' | 'info';

export interface SafetyAlert {
  code: SafetyAlertCode;
  severity: SafetySeverity;
  message: string;
  rulesetVersion: string;
  /** Origen de la regla: 'rule' (determinista) o 'demo' (catálogo no validado). */
  source: 'rule' | 'demo';
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Coincidencia por subcadena en cualquier dirección (p.ej. "penicilina G" ~ "penicilina"). */
function related(a: string, b: string): boolean {
  const x = normalize(a);
  const y = normalize(b);
  if (x === '' || y === '') return false;
  return x.includes(y) || y.includes(x);
}

/**
 * Evalúa una prescripción contra las alergias y la medicación activa del
 * paciente. Devuelve alertas estructuradas (vacío = sin hallazgos). No decide
 * por sí mismo bloquear/continuar: eso lo hace la capa de aplicación según la
 * severidad (crítica = requiere confirmación explícita).
 */
export function checkPrescription(params: {
  drug: string;
  allergies: ReadonlyArray<{ substance: string }>;
  activeMedications: ReadonlyArray<{ drug: string }>;
  /** Edad en años (para verificación pediátrica de dosis). */
  ageYears?: number;
  /** Peso en kg del paciente (para dosis por kg). */
  weightKg?: number;
}): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  const { drug } = params;

  for (const a of params.allergies) {
    if (related(drug, a.substance)) {
      alerts.push({
        code: 'allergy-contraindication',
        severity: 'critical',
        message: `El paciente tiene alergia registrada a "${a.substance}", relacionada con "${drug}".`,
        rulesetVersion: SAFETY_RULESET_VERSION,
        source: 'rule',
      });
    }
  }

  for (const m of params.activeMedications) {
    if (related(drug, m.drug)) {
      alerts.push({
        code: 'duplicate-therapy',
        severity: 'warning',
        message: `Ya existe una prescripción activa relacionada ("${m.drug}"). Revisa duplicidad.`,
        rulesetVersion: SAFETY_RULESET_VERSION,
        source: 'rule',
      });
    }
  }

  // Interacciones fármaco-fármaco con el catálogo DEMO (no validado).
  for (const m of params.activeMedications) {
    for (const rule of DEMO_INTERACTIONS) {
      const hit =
        (related(drug, rule.a) && related(m.drug, rule.b)) ||
        (related(drug, rule.b) && related(m.drug, rule.a));
      if (hit) {
        alerts.push({
          code: 'drug-interaction',
          severity: rule.severity,
          message: `Posible interacción con "${m.drug}": ${rule.note}.`,
          rulesetVersion: INTERACTIONS_DATASET_VERSION,
          source: 'demo',
        });
      }
    }
  }

  // Dosis pediátrica por peso (§NIVEL 8). Sólo para pacientes pediátricos y
  // fármacos del catálogo DEMO. Informativo (human-in-the-loop).
  const isPediatric = params.ageYears !== undefined && params.ageYears < PEDIATRIC_AGE_MAX;
  if (isPediatric) {
    const doseRule = DEMO_PEDIATRIC_DOSING.find((r) => related(drug, r.drug));
    if (doseRule) {
      if (params.weightKg === undefined || params.weightKg <= 0) {
        alerts.push({
          code: 'missing-weight',
          severity: 'warning',
          message:
            'Paciente pediátrico sin peso registrado: no se puede verificar la dosis por kg. Registra el peso.',
          rulesetVersion: SAFETY_RULESET_VERSION,
          source: 'rule',
        });
      } else {
        const min = Math.round(doseRule.minPerKg * params.weightKg);
        const max = Math.round(doseRule.maxPerKg * params.weightKg);
        alerts.push({
          code: 'weight-based-dose',
          severity: 'info',
          message: `Dosis pediátrica sugerida (DEMO) para "${drug}": ${min}–${max} ${doseRule.unit} por ${doseRule.per} (${doseRule.minPerKg}–${doseRule.maxPerKg} ${doseRule.unit}/kg × ${params.weightKg} kg).`,
          rulesetVersion: DOSING_DATASET_VERSION,
          source: 'demo',
        });
      }
    }
  }

  return alerts;
}

export function hasCritical(alerts: ReadonlyArray<SafetyAlert>): boolean {
  return alerts.some((a) => a.severity === 'critical');
}
