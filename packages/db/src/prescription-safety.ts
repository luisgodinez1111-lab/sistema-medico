/**
 * Motor de seguridad de prescripción (§NIVEL 8).
 *
 * Las alertas clínicas son ESTRUCTURADAS y VERSIONADAS, nunca JSX ad-hoc sin
 * gobernanza (§33 #8). Cada alerta lleva código, severidad y la versión del
 * ruleset con que se generó, para trazabilidad y revisión clínica.
 */

export const SAFETY_RULESET_VERSION = '2026.09.1';

export type SafetyAlertCode = 'allergy-contraindication' | 'duplicate-therapy';
export type SafetySeverity = 'critical' | 'warning';

export interface SafetyAlert {
  code: SafetyAlertCode;
  severity: SafetySeverity;
  message: string;
  rulesetVersion: string;
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
      });
    }
  }

  return alerts;
}

export function hasCritical(alerts: ReadonlyArray<SafetyAlert>): boolean {
  return alerts.some((a) => a.severity === 'critical');
}
