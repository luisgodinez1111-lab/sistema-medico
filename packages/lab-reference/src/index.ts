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
