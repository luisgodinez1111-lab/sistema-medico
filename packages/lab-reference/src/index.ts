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
// Rangos de referencia expuestos (para la pestaña "Valores de referencia"): el rango NORMAL es
// [abnormalLow, abnormalHigh] y los límites de pánico son [criticalLow, criticalHigh]. Deterministas.
export type LabRefRange = Readonly<{ analyte: string; normalLow: number; normalHigh: number; criticalLow: number; criticalHigh: number }>;
export function labReferenceRanges(): LabRefRange[] {
  return Object.entries(RANGES).map(([analyte, [cl, al, ah, ch]]) => ({ analyte, normalLow: al, normalHigh: ah, criticalLow: cl, criticalHigh: ch }));
}
// Cadena vacía NO es 0 (Number("") === 0): un campo sin capturar jamás debe leerse como un valor.
function num(x: string): number { const s = String(x).trim().replace(",", "."); if (s === "") return NaN; const n = Number(s); return Number.isFinite(n) ? n : NaN; }

// ---------- Unidades, conversión y plausibilidad (auditoría 2026-09-19: C-01, C-11, C-12) ----------
// Los RANGES de arriba están en UNA unidad canónica por analito. Antes, `classifyLab` no sabía de unidades:
// glucosa 7 (mmol/L, normal) salía "críticamente baja" y creatinina 88.4 (µmol/L, normal) "críticamente alta";
// y un FIB-4 con plaquetas en /µL daba 0.00 → "fibrosis poco probable". Ahora cada analito declara su unidad
// canónica, las unidades alternativas aceptadas (con su conversión) y un intervalo FÍSICAMENTE plausible.
// canónico = valor × factor + offset. Factores estándar de química clínica (peso molecular); HbA1c NGSP↔IFCC.
export type UnitConversion = Readonly<{ factor: number; offset?: number }>;
export type AnalyteUnitSpec = Readonly<{ canonical: string; accepted: Readonly<Record<string, UnitConversion>>; plausible: readonly [number, number] }>;
const same: UnitConversion = { factor: 1 };
export const ANALYTE_UNITS: Readonly<Record<string, AnalyteUnitSpec>> = {
  GLUCOSE: { canonical: "mg/dL", accepted: { "mg/dl": same, "mmol/l": { factor: 18.016 } }, plausible: [10, 2000] },
  POTASSIUM: { canonical: "mEq/L", accepted: { "meq/l": same, "mmol/l": same }, plausible: [1, 12] },
  SODIUM: { canonical: "mEq/L", accepted: { "meq/l": same, "mmol/l": same }, plausible: [90, 200] },
  CHLORIDE: { canonical: "mEq/L", accepted: { "meq/l": same, "mmol/l": same }, plausible: [50, 150] },
  BICARBONATE: { canonical: "mEq/L", accepted: { "meq/l": same, "mmol/l": same }, plausible: [2, 60] },
  HEMOGLOBIN: { canonical: "g/dL", accepted: { "g/dl": same, "g/l": { factor: 0.1 }, "mmol/l": { factor: 1.611 } }, plausible: [2, 25] },
  WBC: { canonical: "10^3/µL", accepted: { "10^3/ul": same, "10^9/l": same, "k/ul": same, "/ul": { factor: 0.001 } }, plausible: [0.1, 500] },
  PLATELETS: { canonical: "10^3/µL", accepted: { "10^3/ul": same, "10^9/l": same, "k/ul": same, "/ul": { factor: 0.001 } }, plausible: [1, 3000] },
  CREATININE: { canonical: "mg/dL", accepted: { "mg/dl": same, "umol/l": { factor: 1 / 88.4 } }, plausible: [0.1, 40] },
  BUN: { canonical: "mg/dL", accepted: { "mg/dl": same, "mmol/l": { factor: 2.801 } }, plausible: [1, 300] },
  INR: { canonical: "INR", accepted: { inr: same, ratio: same, "": same }, plausible: [0.5, 20] }, // adimensional
  LACTATE: { canonical: "mmol/L", accepted: { "mmol/l": same, "mg/dl": { factor: 1 / 9.008 } }, plausible: [0.1, 30] },
  TROPONIN: { canonical: "ng/mL", accepted: { "ng/ml": same, "ng/l": { factor: 0.001 }, "ug/l": same }, plausible: [0, 200] },
  CALCIUM: { canonical: "mg/dL", accepted: { "mg/dl": same, "mmol/l": { factor: 4.008 } }, plausible: [2, 20] },
  MAGNESIUM: { canonical: "mg/dL", accepted: { "mg/dl": same, "mmol/l": { factor: 2.431 }, "meq/l": { factor: 1.2155 } }, plausible: [0.3, 10] },
  PHOSPHORUS: { canonical: "mg/dL", accepted: { "mg/dl": same, "mmol/l": { factor: 3.097 } }, plausible: [0.3, 20] },
  ALT: { canonical: "U/L", accepted: { "u/l": same, "iu/l": same, "ui/l": same }, plausible: [1, 20000] },
  AST: { canonical: "U/L", accepted: { "u/l": same, "iu/l": same, "ui/l": same }, plausible: [1, 20000] },
  BILIRUBIN: { canonical: "mg/dL", accepted: { "mg/dl": same, "umol/l": { factor: 1 / 17.104 } }, plausible: [0.05, 60] },
  ALBUMIN: { canonical: "g/dL", accepted: { "g/dl": same, "g/l": { factor: 0.1 } }, plausible: [0.5, 7] },
  PH: { canonical: "pH", accepted: { ph: same, "": same }, plausible: [6.5, 8.0] },
  PCO2: { canonical: "mmHg", accepted: { mmhg: same, kpa: { factor: 7.50062 } }, plausible: [5, 200] },
  PO2: { canonical: "mmHg", accepted: { mmhg: same, kpa: { factor: 7.50062 } }, plausible: [10, 700] },
  HBA1C: { canonical: "%", accepted: { "%": same, "mmol/mol": { factor: 0.09148, offset: 2.152 } }, plausible: [3, 20] },
  TSH: { canonical: "µUI/mL", accepted: { "uui/ml": same, "uiu/ml": same, "miu/l": same, "mui/l": same }, plausible: [0.001, 500] }, // µUI/mL ≡ mUI/L (misma magnitud); "uIU/mL" es la grafía inglesa
  BNP: { canonical: "pg/mL", accepted: { "pg/ml": same, "ng/l": same }, plausible: [1, 50000] },
  DDIMER: { canonical: "ng/mL", accepted: { "ng/ml": same, "ug/l": same, "ug/ml": { factor: 1000 }, "mg/l": { factor: 1000 } }, plausible: [10, 100000] },
  CRP: { canonical: "mg/L", accepted: { "mg/l": same, "mg/dl": { factor: 10 } }, plausible: [0, 600] },
};
// Clave de comparación de unidades: minúsculas, sin espacios, µ/μ→u, "×10^3"→"10^3", superíndices comunes.
function unitKey(u: string): string {
  return u.trim().toLowerCase().replace(/\s+/g, "").replace(/[µμ]/g, "u").replace(/^x?10\^?3\/?(ul|mm3)$/, "10^3/ul").replace(/^x?10\^?9\/l$/, "10^9/l").replace(/\/mm3$/, "/ul");
}
export type LabValueNormalization =
  | Readonly<{ ok: true; canonicalValue: number; canonicalUnit: string | null; unitAssumed: boolean }>
  | Readonly<{ ok: false; reason: "NOT_NUMERIC" | "UNKNOWN_UNIT" | "IMPLAUSIBLE"; message: string }>;
// Lleva un valor de laboratorio a la unidad canónica del analito y comprueba que sea físicamente plausible.
// `unit` ausente => se ASUME la canónica (unitAssumed=true) pero la plausibilidad igual atrapa los cruces SI↔convencional.
export function normalizeLabValue(analyte: string, value: string | number, unit?: string): LabValueNormalization {
  const key = analyte.trim().toUpperCase();
  const v = typeof value === "number" ? value : num(value);
  if (!Number.isFinite(v)) return { ok: false, reason: "NOT_NUMERIC", message: "Valor no numérico" };
  const spec = ANALYTE_UNITS[key];
  const given = unit !== undefined && unit.trim() !== "";
  if (!spec) return { ok: true, canonicalValue: v, canonicalUnit: given ? unit!.trim() : null, unitAssumed: !given };
  let canonical = v;
  if (given) {
    const conv = spec.accepted[unitKey(unit!)];
    if (!conv) return { ok: false, reason: "UNKNOWN_UNIT", message: `Unidad "${unit!.trim()}" no reconocida para ${key}; use ${spec.canonical}${Object.keys(spec.accepted).length > 1 ? " (u otra unidad admitida)" : ""}` };
    canonical = v * conv.factor + (conv.offset ?? 0);
  }
  const [lo, hi] = spec.plausible;
  if (canonical < lo || canonical > hi) return { ok: false, reason: "IMPLAUSIBLE", message: `${key} = ${v}${given ? " " + unit!.trim() : ""} no es plausible en ${spec.canonical} (${lo}–${hi}). Verifique el valor y la UNIDAD.` };
  return { ok: true, canonicalValue: Math.round(canonical * 1000) / 1000, canonicalUnit: spec.canonical, unitAssumed: !given };
}
// Nombre clínico en español de cada analito tabulado: los mensajes al médico ("Requiere creatinina") nunca deben
// mostrar el código interno. Analito no tabulado => se devuelve el propio código.
const ANALYTE_LABEL_ES: Readonly<Record<string, string>> = {
  GLUCOSE: "glucosa", POTASSIUM: "potasio", SODIUM: "sodio", CHLORIDE: "cloro", BICARBONATE: "bicarbonato (HCO₃)", HEMOGLOBIN: "hemoglobina",
  WBC: "leucocitos", PLATELETS: "plaquetas", CREATININE: "creatinina", BUN: "nitrógeno ureico (BUN)", INR: "INR", LACTATE: "lactato",
  TROPONIN: "troponina", CALCIUM: "calcio", MAGNESIUM: "magnesio", PHOSPHORUS: "fósforo", ALT: "ALT", AST: "AST", BILIRUBIN: "bilirrubina total",
  ALBUMIN: "albúmina", PH: "pH arterial", PCO2: "pCO₂", PO2: "pO₂", HBA1C: "HbA1c", TSH: "TSH", BNP: "BNP", DDIMER: "dímero D", CRP: "proteína C reactiva",
};
export function analyteLabel(analyte: string): string { const k = analyte.trim().toUpperCase(); return ANALYTE_LABEL_ES[k] ?? k; }
export function canonicalUnitOf(analyte: string): string | undefined { return ANALYTE_UNITS[analyte.trim().toUpperCase()]?.canonical; }
const UNIT_LABEL: Readonly<Record<string, string>> = { "mg/dl": "mg/dL", "mmol/l": "mmol/L", "umol/l": "µmol/L", "meq/l": "mEq/L", "g/dl": "g/dL", "g/l": "g/L", "10^3/ul": "10^3/µL", "10^9/l": "10^9/L", "k/ul": "K/µL", "/ul": "/µL", "u/l": "U/L", "iu/l": "UI/L", "ui/l": "UI/L", "ng/ml": "ng/mL", "ng/l": "ng/L", "ug/l": "µg/L", "ug/ml": "µg/mL", "mg/l": "mg/L", "pg/ml": "pg/mL", "uui/ml": "µUI/mL", "uiu/ml": "µUI/mL", "miu/l": "mUI/L", "mui/l": "mUI/L", mmhg: "mmHg", kpa: "kPa", "mmol/mol": "mmol/mol", "%": "%", ph: "pH", inr: "INR" }; // "ratio" se acepta al recibir pero no se ofrece: el INR es adimensional
// Unidades admitidas para capturar un analito (la canónica primero), con etiqueta legible. [] si el analito no está tabulado.
export function acceptedUnitsOf(analyte: string): string[] {
  const s = ANALYTE_UNITS[analyte.trim().toUpperCase()]; if (!s) return [];
  const out = [s.canonical];
  for (const k of Object.keys(s.accepted)) { const label = UNIT_LABEL[k]; if (label && !out.some((o) => o.toLowerCase() === label.toLowerCase())) out.push(label); }
  return out;
}

export function classifyLab(analyte: string, value: string, unit?: string): LabAssessment {
  const key = analyte.trim().toUpperCase();
  const rng = RANGES[key];
  if (!rng) return { status: "UNKNOWN", critical: false, interpretation: "Analito sin rango de referencia" };
  // Unidad y plausibilidad ANTES de clasificar: un valor en otra unidad o implausible es DESCONOCIDO, nunca "crítico".
  const n = normalizeLabValue(key, value, unit);
  if (!n.ok) return { status: "UNKNOWN", critical: false, interpretation: n.message };
  const v = n.canonicalValue;
  const [cl, al, ah, ch] = rng;
  if ((cl > 0 && v < cl) || v > ch) return { status: "CRITICAL", critical: true, interpretation: v > ch ? `${key} críticamente alto` : `${key} críticamente bajo` };
  if ((al > 0 && v < al) || v > ah) return { status: "ABNORMAL", critical: false, interpretation: v > ah ? `${key} alto` : `${key} bajo` };
  return { status: "NORMAL", critical: false, interpretation: `${key} normal` };
}

// ---------- Delta check (variación crítica entre resultados) — EPIC BB ----------
// Compara un resultado nuevo con el valor PREVIO del mismo analito del paciente. Atrapa deterioro rápido
// y confusiones de muestra que el umbral absoluto NO detecta (p. ej. una caída grande de Hb todavía dentro
// del rango "bajo pero no pánico"). Un delta CRÍTICO eleva el resultado a `critical` -> participa del
// gate de firma (Zero Lost Follow-Up). Puro, sin PHI. Umbrales de demostración.
export type DeltaSeverity = "CRITICAL" | "NONE";
export type DeltaAssessment = Readonly<{ flagged: boolean; severity: DeltaSeverity; changeAbs: number; changePct: number; note: string }>;
type DeltaRule = Readonly<{ direction: "up" | "down" | "any"; criticalAbs?: number; criticalRatio?: number; note: string }>;
// direction = dirección clínicamente peligrosa; criticalRatio se evalúa como new/old.
const DELTA_RULES: Record<string, DeltaRule> = {
  CREATININE: { direction: "up", criticalAbs: 0.5, criticalRatio: 2, note: "aumento agudo de creatinina: posible lesión renal aguda (AKI)" },
  HEMOGLOBIN: { direction: "down", criticalAbs: 2, note: "caída de hemoglobina >=2 g/dL: posible hemorragia aguda" },
  SODIUM: { direction: "any", criticalAbs: 10, note: "cambio rápido de sodio: riesgo de corrección peligrosa (mielinólisis/edema)" },
  POTASSIUM: { direction: "any", criticalAbs: 1, note: "cambio agudo de potasio: riesgo de arritmia" },
  PLATELETS: { direction: "down", criticalRatio: 0.5, note: "caída de plaquetas >=50%: posible consumo/HIT" },
  CALCIUM: { direction: "any", criticalAbs: 2, note: "cambio rápido de calcio" },
  GLUCOSE: { direction: "any", criticalAbs: 200, note: "variación glucémica extrema" },
};
function round2(n: number): number { return Math.round(n * 100) / 100; }
export function deltaCheck(analyte: string, priorValue: string, newValue: string): DeltaAssessment {
  const none: DeltaAssessment = { flagged: false, severity: "NONE", changeAbs: 0, changePct: 0, note: "" };
  const rule = DELTA_RULES[analyte.trim().toUpperCase()];
  if (!rule) return none;
  const oldV = num(priorValue), newV = num(newValue);
  if (Number.isNaN(oldV) || Number.isNaN(newV)) return none;
  const changeAbs = newV - oldV;
  const drop = oldV - newV, rise = changeAbs;
  const changePct = oldV !== 0 ? round2((changeAbs / Math.abs(oldV)) * 100) : 0;
  let hit = false;
  if (rule.criticalAbs !== undefined) {
    const mag = rule.direction === "up" ? rise : rule.direction === "down" ? drop : Math.abs(changeAbs);
    if (mag >= rule.criticalAbs) hit = true;
  }
  if (!hit && rule.criticalRatio !== undefined && oldV > 0) {
    const ratio = newV / oldV;
    if (rule.direction === "down" ? ratio <= rule.criticalRatio : ratio >= rule.criticalRatio) hit = true;
  }
  return hit ? { flagged: true, severity: "CRITICAL", changeAbs: round2(changeAbs), changePct, note: rule.note } : { ...none, changeAbs: round2(changeAbs), changePct };
}

// ---------- NEWS2 — National Early Warning Score 2 (EPIC BC) ----------
// CDS agregado multiparamétrico: suma 7 parámetros de signos vitales en un score de acuidad con banda de
// riesgo y recomendación de escalamiento. A diferencia del CDS por umbral (classifyLab/classifyVital) o
// temporal (deltaCheck), integra el estado fisiológico GLOBAL. Puro, sin PHI. Escala SpO2 1 (sin EPOC).
// Referencia: Royal College of Physicians, NEWS2. Parámetros faltantes se reportan (score = cota inferior).
export type News2Band = "LOW" | "MEDIUM" | "HIGH";
export type News2Params = Readonly<{ resp?: number | undefined; spo2?: number | undefined; temp?: number | undefined; sbp?: number | undefined; hr?: number | undefined; consciousness?: string | undefined; supplementalO2?: boolean | undefined }>;
export type News2Result = Readonly<{ score: number; band: News2Band; redFlag: boolean; escalation: boolean; params: Readonly<Record<string, number>>; missing: readonly string[] }>;
function scoreResp(v: number): number { if (v <= 8) return 3; if (v <= 11) return 1; if (v <= 20) return 0; if (v <= 24) return 2; return 3; }
function scoreSpo2(v: number): number { if (v >= 96) return 0; if (v >= 94) return 1; if (v >= 92) return 2; return 3; }
function scoreTemp(v: number): number { if (v <= 35.0) return 3; if (v <= 36.0) return 1; if (v <= 38.0) return 0; if (v <= 39.0) return 1; return 2; }
function scoreSbp(v: number): number { if (v <= 90) return 3; if (v <= 100) return 2; if (v <= 110) return 1; if (v <= 219) return 0; return 3; }
function scoreHr(v: number): number { if (v <= 40) return 3; if (v <= 50) return 1; if (v <= 90) return 0; if (v <= 110) return 1; if (v <= 130) return 2; return 3; }
function scoreConsciousness(v: string): number { const s = v.trim().toUpperCase(); return (s === "A" || s === "ALERT") ? 0 : 3; }
export function computeNEWS2(p: News2Params): News2Result {
  const params: Record<string, number> = {}; const missing: string[] = [];
  const put = (key: string, val: number | undefined, fn: (n: number) => number) => {
    if (val === undefined || Number.isNaN(val)) { missing.push(key); return; }
    params[key] = fn(val);
  };
  put("resp", p.resp, scoreResp);
  put("spo2", p.spo2, scoreSpo2);
  put("temp", p.temp, scoreTemp);
  put("sbp", p.sbp, scoreSbp);
  put("hr", p.hr, scoreHr);
  if (p.consciousness !== undefined) params["consciousness"] = scoreConsciousness(p.consciousness); else missing.push("consciousness");
  params["supplementalO2"] = p.supplementalO2 ? 2 : 0; // aire ambiente por defecto
  const score = Object.values(params).reduce((a, b) => a + b, 0);
  const redFlag = Object.values(params).some((s) => s === 3);
  const band: News2Band = score >= 7 ? "HIGH" : (score >= 5 || redFlag) ? "MEDIUM" : "LOW";
  return { score, band, redFlag, escalation: band !== "LOW", params, missing };
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
