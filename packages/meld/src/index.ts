// EPIC BW — MELD (Model for End-stage Liver Disease): pronóstico de gravedad/mortalidad en hepatopatía
// avanzada (MELD clásico, UNOS 2002; la asignación de trasplante usa hoy MELD-Na / MELD 3.0). MELD = 3.78·ln(bilirrubina) + 11.2·ln(INR) +
// 9.57·ln(creatinina) + 6.43. Valores <1 se fijan en 1; creatinina se acota a [1,4]. Score 6–40. Puro, sin PHI.
export type MeldRisk="LOW"|"MODERATE"|"HIGH"|"VERY_HIGH";
export type MeldVersion="MELD-2001"|"MELD-Na-2016";
export type MeldResult=Readonly<{score:number;risk:MeldRisk;mortality90d:string;mortality90dPct:number;version:MeldVersion;
 /** Advertencia permanente: la asignación de órganos usa MELD 3.0 (Kim 2021) desde 2023 y este sistema NO lo implementa. */
 allocationNote:string}>;
// Auditoría 2026-09-19, anexo R03 (R03-21): las bandas de mortalidad estaban MAL. Decían «~20–52 %» para 20–29, que mezcla
// dos tramos de la tabla original: Wiesner RH et al. «MELD and allocation of donor livers» (Gastroenterology
// 2003;124:91-96) asigna 19.6 % a 20–29 y 52.6 % a 30–39. Un rango que se solapa con el tramo siguiente no informa: da la
// impresión de precisión donde hay un error de lectura de la tabla.
const WIESNER_2003:readonly Readonly<{maxScore:number;pct:number;risk:MeldRisk}>[]=[
 {maxScore:9,pct:1.9,risk:"LOW"},
 {maxScore:19,pct:6.0,risk:"MODERATE"},
 {maxScore:29,pct:19.6,risk:"HIGH"},
 {maxScore:39,pct:52.6,risk:"VERY_HIGH"},
 {maxScore:40,pct:71.3,risk:"VERY_HIGH"},
];
const ALLOCATION_NOTE="Pronóstico de gravedad. La ASIGNACIÓN de hígado para trasplante usa MELD 3.0 (Kim WR et al., Gastroenterology 2021) desde 2023, que añade albúmina, sodio y sexo y acota la creatinina a 3.0: este sistema NO lo implementa y no debe usarse para priorizar trasplante.";
function bandFor(score:number):Readonly<{pct:number;risk:MeldRisk}>{
 const b=WIESNER_2003.find(x=>score<=x.maxScore)??WIESNER_2003[WIESNER_2003.length-1]!;
 return{pct:b.pct,risk:b.risk};
}
// Auditoría 2026-09-19 (C-19): `dialysis` = ≥2 sesiones de hemodiálisis en la última semana (o 24 h de terapia continua):
// UNOS fija entonces la creatinina en 4.0 mg/dL. Sin ese dato, el puntaje de un paciente en diálisis SUBESTIMA la gravedad.
export function meldScore(bilirubin:number,inr:number,creatinine:number,opts:Readonly<{dialysis?:boolean}>={}):MeldResult|undefined{
 if(![bilirubin,inr,creatinine].every(Number.isFinite)||bilirubin<0||inr<=0||creatinine<0)return undefined;
 const bili=Math.max(bilirubin,1),inrC=Math.max(inr,1),creat=opts.dialysis?4:Math.min(Math.max(creatinine,1),4);
 const raw=3.78*Math.log(bili)+11.2*Math.log(inrC)+9.57*Math.log(creat)+6.43;
 const score=Math.max(6,Math.min(40,Math.round(raw)));
 const b=bandFor(score);
 return{score,risk:b.risk,mortality90d:`${b.pct}% mortalidad a 3 meses (Wiesner 2003)`,mortality90dPct:b.pct,version:"MELD-2001",allocationNote:ALLOCATION_NOTE};
}

// ---------- MELD-Na (UNOS 2016) ----------
// Auditoría R03-21: el módulo se describía como base para «priorizar trasplante» con la versión de 2001, que dejó de
// usarse para eso. MELD-Na es el siguiente escalón publicado y sí se puede implementar con seguridad:
//   MELD-Na = MELD + 1.32·(137 − Na) − [0.033 · MELD · (137 − Na)], con el sodio acotado a 125–137 y aplicado solo si
//   MELD > 11 (por debajo no se corrige). Fuente: Kim WR et al., N Engl J Med 2008;359:1018-26, adoptado por UNOS/OPTN en
//   enero de 2016. MELD 3.0 (2021) NO se implementa: son nueve términos y su transcripción a ciegas no es aceptable en
//   contenido clínico; la salida lo declara para que nadie use este número para asignar un órgano.
export const MELD_NA_SODIUM_BOUNDS=[125,137]as const;
export function meldNaScore(bilirubin:number,inr:number,creatinine:number,sodium:number,opts:Readonly<{dialysis?:boolean}>={}):MeldResult|undefined{
 const base=meldScore(bilirubin,inr,creatinine,opts);
 if(!base)return undefined;
 if(!Number.isFinite(sodium))return undefined;
 const[lo,hi]=MELD_NA_SODIUM_BOUNDS;
 const na=Math.min(Math.max(sodium,lo),hi);
 // Por debajo de MELD 11 la corrección por sodio no se aplica (regla de la propia política de UNOS).
 const raw=base.score<=11?base.score:base.score+1.32*(137-na)-0.033*base.score*(137-na);
 const score=Math.max(6,Math.min(40,Math.round(raw)));
 const b=bandFor(score);
 return{score,risk:b.risk,mortality90d:`${b.pct}% mortalidad a 3 meses (Wiesner 2003, banda del MELD equivalente)`,mortality90dPct:b.pct,version:"MELD-Na-2016",allocationNote:ALLOCATION_NOTE};
}
