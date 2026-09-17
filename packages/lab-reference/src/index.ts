// EPIC AQ — Rangos de referencia de laboratorio + valores de pánico (PROFUNDIDAD del eje C / CDS).
// Deriva el estado clínico (NORMAL/ABNORMAL/CRITICAL) y el flag `critical` del VALOR real de un analito,
// en vez de confiar en un booleano del cliente. Alimenta el closed-loop de resultados críticos
// (Zero Lost Follow-Up). Puro, sin PHI. Umbrales de adulto de demostración; los oficiales/por método
// se parametrizarían del laboratorio. Autoridad: PROD (resultados críticos / valores de pánico), CAP-LAB-REF-001.
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

function num(x: string): number {
  const n = Number(String(x).trim());
  return Number.isFinite(n) ? n : NaN;
}

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

// EPIC AN — Rangos de referencia de signos vitales + clasificación clínica (PROFUNDIDAD del eje C).
// Deriva el estado clínico (NORMAL/ABNORMAL/CRITICAL) y el flag `critical` del VALOR real de un signo vital,
// en vez de confiar en un booleano del cliente. Alimenta el closed-loop de signos vitales y
// integración con encuentros clínicos. Puro, sin PHI. Umbrales de adulto de demostración; los umbrales
// oficiales por edad/población se parametrizarían del protocolo institucional. Autoridad: PROD (CDS básico),
// CAP-VITALS-REF-001.
export type VitalStatus = "NORMAL" | "ABNORMAL" | "CRITICAL" | "UNKNOWN";
export type VitalAssessment = Readonly<{ status: VitalStatus; critical: boolean; interpretation: string }>;

// Umbrales de referencia adulto (demostración; oficiales por edad/población se parametrizarían).
const VITAL_RANGES: Record<string, readonly [string, number, number]> = {
  HR: ["HR", 60, 100],         // latidos/minuto
  SPO2: ["SPO2", 95, 100],     // saturación O2 %
  TEMP: ["TEMP", 36, 37.5],    // temperatura °C
  RESP: ["RESP", 12, 20],      // respiraciones/min
  SYSBP: ["SYSBP", 90, 120],   // presión sistólica
  DIABP: ["DIABP", 60, 80],    // presión diastólica
};

// Helper: worst of two statuses (higher priority = more critical)
function worst(a: VitalStatus, b: VitalStatus): VitalStatus {
  const rank = { CRITICAL: 0, ABNORMAL: 1, NORMAL: 2, UNKNOWN: 3 } as const;
  return rank[a] <= rank[b] ? a : b;
}

// classifyVital: deriva VitalStatus y critical flag desde el valor real de un signo vital
export function classifyVital(vitalType: string, value: string): VitalAssessment {
  const t = vitalType.trim().toUpperCase();
  const rng = VITAL_RANGES[t];
  if (!rng) return { status: "UNKNOWN", critical: false, interpretation: "Signo vital sin rango de referencia" };
  const v = num(value);
  if (Number.isNaN(v)) return { status: "UNKNOWN", critical: false, interpretation: "Valor no numérico" };

  // Frecuencia Cardíaca (latidos/min)
  if (t === "HR") {
    if (v < 40 || v > 130) return { status: "CRITICAL", critical: true, interpretation: v > 130 ? "Taquicardia severa" : "Bradicardia severa" };
    if (v < 60 || v > 100) return { status: "ABNORMAL", critical: false, interpretation: v > 100 ? "Taquicardia" : "Bradicardia" };
    return { status: "NORMAL", critical: false, interpretation: "Frecuencia cardíaca normal" };
  }

  // Saturación de Oxígeno (%)
  if (t === "SPO2") {
    if (v < 90) return { status: "CRITICAL", critical: true, interpretation: "Hipoxemia severa" };
    if (v < 94) return { status: "ABNORMAL", critical: false, interpretation: "Hipoxemia" };
    return { status: "NORMAL", critical: false, interpretation: "Saturación normal" };
  }

  // Temperatura corporal (°C)
  if (t === "TEMP") {
    if (v >= 38 || v < 36) return { status: "ABNORMAL", critical: false, interpretation: v >= 38 ? "Fiebre" : "Temperatura baja" };
    if (v >= 40 || v <= 35) return { status: "CRITICAL", critical: true, interpretation: v >= 40 ? "Hipertermia" : "Hipotermia" };
    return { status: "NORMAL", critical: false, interpretation: "Temperatura normal" };
  }

  // Frecuencia Respiratoria (respiraciones/min)
  if (t === "RESP") {
    if (v < 8 || v > 30) return { status: "CRITICAL", critical: true, interpretation: v > 30 ? "Taquipnea severa" : "Bradipnea severa" };
    if (v < 12 || v > 20) return { status: "ABNORMAL", critical: false, interpretation: v > 20 ? "Taquipnea" : "Bradipnea" };
    return { status: "NORMAL", critical: false, interpretation: "Frecuencia respiratoria normal" };
  }

  // Presión Arterial (formato "120/80")
  if (t === "BP") {
    const m = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(String(value).trim());
    if (!m) return { status: "UNKNOWN", critical: false, interpretation: "Formato de presión no reconocido (esperado S/D)" };
    const s = Number(m[1]);
    const d = Number(m[2]);
    let ss: VitalStatus = "NORMAL";
    let ds: VitalStatus = "NORMAL";
    if (s >= 180 || s < 70) ss = "CRITICAL";
    else if (s >= 140 || s < 90) ss = "ABNORMAL";
    if (d >= 120) ds = "CRITICAL";
    else if (d >= 90 || d < 60) ds = "ABNORMAL";
    const st = worst(ss, ds);
    let label = "Presión normal";
    if (st === "CRITICAL") label = s >= 180 || d >= 120 ? "Crisis hipertensiva" : "Hipotensión severa";
    else if (st === "ABNORMAL") label = s >= 140 || d >= 90 ? "Hipertensión" : "Hipotensión";
    return { status: st, critical: st === "CRITICAL", interpretation: label };
  }

  return { status: "UNKNOWN", critical: false, interpretation: "Tipo de signo vital no reconocido" };
}