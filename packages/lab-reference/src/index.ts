// EPIC AQ + AN — Rangos de referencia clínicos (PROFUNDIDAD del eje C / CDS).
// Deriva el estado clínico (NORMAL/ABNORMAL/CRITICAL) y el flag `critical` del VALOR real, en vez de
// confiar en un booleano del cliente. Alimenta los closed-loops de resultados críticos (Zero Lost
// Follow-Up) y de signos vitales críticos (care gaps). Puro, sin PHI. Umbrales de adulto de demostración;
// los oficiales/por método/edad se parametrizarían de la fuente autorizada.
// Autoridad: PROD (valores de pánico de laboratorio / CDS de signos vitales), CAP-LAB-REF-001 / CAP-VITALS-REF-001.

// ---------- Laboratorio ----------
export type LabStatus = "NORMAL" | "ABNORMAL" | "CRITICAL" | "UNKNOWN";
export type LabAssessment = Readonly<{ status: LabStatus; critical: boolean; interpretation: string }>;
// [criticalLow, abnormalLow, abnormalHigh, criticalHigh]
const RANGES: Record<string, readonly [number, number, number, number]> = {
  GLUCOSE: [40, 70, 200, 500],        // mg/dL
  POTASSIUM: [2.5, 3.5, 5.1, 6.5],    // mEq/L
  SODIUM: [120, 135, 145, 160],       // mEq/L
  HEMOGLOBIN: [7, 12, 17, 20],        // g/dL
  WBC: [1, 4, 11, 30],                // 10^3/uL
  PLATELETS: [20, 150, 400, 1000],    // 10^3/uL
  CREATININE: [0, 0, 1.3, 4],         // mg/dL (sin límite bajo relevante)
  INR: [0, 0, 3.5, 5],                // sin límite bajo
  LACTATE: [0, 0, 2, 4],              // mmol/L
  TROPONIN: [0, 0, 0.04, 0.04],       // ng/mL: cualquier elevación >0.04 es crítica
  // — Ampliación 2026-09-17 —
  CALCIUM: [6, 8.5, 10.5, 13],        // mg/dL (calcio total)
  MAGNESIUM: [1, 1.7, 2.4, 4.9],      // mg/dL
  PHOSPHORUS: [1, 2.5, 4.5, 8],       // mg/dL
  CHLORIDE: [80, 98, 107, 120],       // mEq/L
  BICARBONATE: [10, 22, 29, 40],      // mEq/L (HCO3)
  BUN: [0, 0, 20, 100],               // mg/dL (nitrógeno ureico)
  ALT: [0, 0, 40, 1000],              // U/L
  AST: [0, 0, 40, 1000],              // U/L
  BILIRUBIN: [0, 0, 1.2, 15],         // mg/dL (total)
  ALBUMIN: [1.5, 3.5, 5.5, 99],       // g/dL (crítico bajo)
  PH: [7.2, 7.35, 7.45, 7.55],        // arterial
  PCO2: [20, 35, 45, 70],             // mmHg
  PO2: [40, 60, 100, 999],            // mmHg (crítico bajo por hipoxemia)
  HBA1C: [0, 0, 6.5, 10],             // % (control glucémico)
  TSH: [0.01, 0.4, 4.5, 100],         // uIU/mL
  BNP: [0, 0, 100, 400],              // pg/mL (insuficiencia cardíaca)
  DDIMER: [0, 0, 500, 5000],          // ng/mL
  CRP: [0, 0, 10, 100],               // mg/L (proteína C reactiva)
};
function num(x: string): number { const n = Number(String(x).trim()); return Number.isFinite(n) ? n : NaN; }
export function classifyLab(analyte: string, value: string): LabAssessment {
  const key = analyte.trim().toUpperCase();
  const rng = RANGES[key];
  if (!rng) return { status: "UNKNOWN", critical: false, interpretation: "Analito sin rango de referencia" };
  const v = num(value);
  if (Number.isNaN(v)) return { status: "UNKNOWN", critical: false, interpretation: "Valor no numérico" };
  const [cl, al, ah, ch] = rng;
  if ((cl > 0 && v < cl) || v > ch) return { status: "CRITICAL", critical: true, interpretation: v > ch ? `${key} críticamente alto` : `${key} críticamente bajo` };
  if ((al > 0 && v < al) || v > ah) return { status: "ABNORMAL", critical: false, interpretation: v > ah ? `${key} alto` : `${key} bajo` };
  return { status: "NORMAL", critical: false, interpretation: `${key} normal` };
}

// ---------- Signos vitales ----------
export type VitalStatus = "NORMAL" | "ABNORMAL" | "CRITICAL" | "UNKNOWN";
export type VitalAssessment = Readonly<{ status: VitalStatus; critical: boolean; interpretation: string }>;
function worst(a: VitalStatus, b: VitalStatus): VitalStatus { const rank = { CRITICAL: 0, ABNORMAL: 1, NORMAL: 2, UNKNOWN: 3 } as const; return rank[a] <= rank[b] ? a : b; }
export function classifyVital(vitalType: string, value: string): VitalAssessment {
  const t = vitalType.trim().toUpperCase();
  const crit = (status: VitalStatus, interpretation: string): VitalAssessment => ({ status, critical: status === "CRITICAL", interpretation });
  switch (t) {
    case "BP": {
      const m = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(String(value).trim());
      if (!m) return crit("UNKNOWN", "Formato de presión no reconocido (esperado S/D)");
      const s = Number(m[1]), d = Number(m[2]);
      let ss: VitalStatus = "NORMAL"; if (s >= 180 || s < 70) ss = "CRITICAL"; else if (s >= 140 || s < 90) ss = "ABNORMAL";
      let ds: VitalStatus = "NORMAL"; if (d >= 120) ds = "CRITICAL"; else if (d >= 90 || d < 60) ds = "ABNORMAL";
      const st = worst(ss, ds);
      const label = st === "CRITICAL" ? (s >= 180 || d >= 120 ? "Crisis hipertensiva" : "Hipotensión severa") : st === "ABNORMAL" ? (s >= 140 || d >= 90 ? "Hipertensión" : "Hipotensión") : "Presión normal";
      return crit(st, label);
    }
    case "HR": { const v = num(value); if (Number.isNaN(v)) return crit("UNKNOWN", "Valor no numérico");
      if (v < 40 || v > 130) return crit("CRITICAL", v > 130 ? "Taquicardia severa" : "Bradicardia severa");
      if (v < 60 || v > 100) return crit("ABNORMAL", v > 100 ? "Taquicardia" : "Bradicardia");
      return crit("NORMAL", "Frecuencia cardíaca normal"); }
    case "SPO2": { const v = num(value); if (Number.isNaN(v)) return crit("UNKNOWN", "Valor no numérico");
      if (v < 90) return crit("CRITICAL", "Hipoxemia severa");
      if (v < 94) return crit("ABNORMAL", "Hipoxemia");
      return crit("NORMAL", "Saturación normal"); }
    case "TEMP": { const v = num(value); if (Number.isNaN(v)) return crit("UNKNOWN", "Valor no numérico");
      if (v >= 40 || v <= 35) return crit("CRITICAL", v >= 40 ? "Hipertermia" : "Hipotermia");
      if (v >= 38 || v < 36) return crit("ABNORMAL", v >= 38 ? "Fiebre" : "Temperatura baja");
      return crit("NORMAL", "Temperatura normal"); }
    case "RESP": { const v = num(value); if (Number.isNaN(v)) return crit("UNKNOWN", "Valor no numérico");
      if (v < 8 || v > 30) return crit("CRITICAL", v > 30 ? "Taquipnea severa" : "Bradipnea severa");
      if (v < 12 || v > 20) return crit("ABNORMAL", v > 20 ? "Taquipnea" : "Bradipnea");
      return crit("NORMAL", "Frecuencia respiratoria normal"); }
    default: return crit("UNKNOWN", "Sin rango de referencia para este tipo");
  }
}
