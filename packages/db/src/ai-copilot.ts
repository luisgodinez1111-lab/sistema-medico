import { createHash } from 'node:crypto';

/**
 * AI Copilot (Release R6) — ANDAMIAJE human-in-the-loop.
 *
 * Reglas del plan (§14, §33 #9-#10):
 * - Contexto MÍNIMO y sin PHI de identidad (solo problemas + alergias); nunca el
 *   expediente completo a un proveedor de IA.
 * - La IA SUGIERE; el clínico decide. Nada se escribe al expediente aquí.
 * - Se registra provenance (engine/policy/contextHash), nunca el chain-of-thought.
 * - Los prompts no sustituyen la arquitectura clínica estructurada.
 *
 * El motor actual es un STUB DETERMINISTA marcado DEMO (no IA). El proveedor real
 * (Claude vía AI Gateway) se conecta detrás de env var sin cambiar este contrato.
 */

export const AI_POLICY_VERSION = 'demo-2026.09.1';
export const AI_ENGINE = 'stub-demo (no IA)';

/** Contexto mínimo desidentificado que alimenta al copiloto. */
export interface CopilotContext {
  conditions: ReadonlyArray<{ code: string }>;
  allergies: ReadonlyArray<{ substance: string; criticality: string }>;
}

export interface CopilotSuggestion {
  code: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning';
}

export interface CopilotResult {
  suggestions: CopilotSuggestion[];
  engine: string;
  policyVersion: string;
  /** Hash del contexto mínimo (para provenance; sin PHI de identidad). */
  contextHash: string;
}

function normalize(v: string): string {
  return v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Genera sugerencias a partir del contexto mínimo. STUB determinista (no IA):
 * reglas simples marcadas DEMO. Devuelve también el hash del contexto para
 * registrar provenance sin exponer PHI.
 */
export function generateSuggestions(context: CopilotContext): CopilotResult {
  const suggestions: CopilotSuggestion[] = [];
  const codes = context.conditions.map((c) => normalize(c.code));

  if (codes.some((c) => c.includes('diabetes'))) {
    suggestions.push({
      code: 'dm2-hba1c',
      title: 'Considerar HbA1c de control (DEMO)',
      detail: 'Paciente con diabetes: valorar HbA1c si no hay una reciente.',
      severity: 'info',
    });
  }
  if (codes.some((c) => c.includes('hipertension'))) {
    suggestions.push({
      code: 'hta-ta',
      title: 'Registrar tensión arterial (DEMO)',
      detail: 'Paciente con hipertensión: confirmar TA en la visita.',
      severity: 'info',
    });
  }
  for (const a of context.allergies) {
    if (a.criticality === 'high') {
      suggestions.push({
        code: `allergy-${normalize(a.substance)}`,
        title: `Alergia de alto riesgo: ${a.substance} (DEMO)`,
        detail: `Evitar ${a.substance} y relacionados; verificar toda prescripción.`,
        severity: 'warning',
      });
    }
  }

  const contextHash = createHash('sha256')
    .update(
      JSON.stringify({
        c: codes.sort(),
        a: context.allergies.map((x) => normalize(x.substance)).sort(),
      }),
    )
    .digest('hex');

  return { suggestions, engine: AI_ENGINE, policyVersion: AI_POLICY_VERSION, contextHash };
}
