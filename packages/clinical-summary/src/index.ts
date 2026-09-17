// EPIC BS — Resumen de inteligencia clínica DETERMINISTA: consolida los cálculos por reglas (CDS por umbral,
// eGFR, NEWS2, glucémico, CHA2DS2-VASc, FIB-4, IMC, care gaps, obligaciones críticas) en una lista de hallazgos
// PRIORIZADA por severidad. Núcleo determinista (no IA generativa; R6 en pausa). Puro, sin PHI (recibe métricas).
export type Severity="CRITICAL"|"WARNING"|"INFO";
export type Finding=Readonly<{domain:string;severity:Severity;summary:string}>;
export type SummaryInputs=Readonly<{
 openCriticalResults?:number;
 openCriticalVitals?:number;
 news2?:{score:number;band:"LOW"|"MEDIUM"|"HIGH"};
 egfr?:{egfr:number;stage:string};
 glycemic?:{category:string;label:string};
 cha2ds2vasc?:{score:number;risk:"LOW"|"INTERMEDIATE"|"HIGH";applicable:boolean};
 fib4?:{value:number;risk:"LOW"|"INDETERMINATE"|"HIGH"};
 bmi?:{category:string};
 overdueVaccines?:number;
}>;
const RANK:Record<Severity,number>={CRITICAL:0,WARNING:1,INFO:2};
// Ensambla y prioriza. Cada regla es explícita y determinista.
export function assembleFindings(i:SummaryInputs):Finding[]{
 const f:Finding[]=[];
 if(i.openCriticalResults&&i.openCriticalResults>0)f.push({domain:"resultados",severity:"CRITICAL",summary:`${i.openCriticalResults} resultado(s) crítico(s) sin cerrar`});
 if(i.openCriticalVitals&&i.openCriticalVitals>0)f.push({domain:"vitales",severity:"CRITICAL",summary:`${i.openCriticalVitals} signo(s) vital(es) crítico(s) sin atender`});
 if(i.news2){if(i.news2.band==="HIGH")f.push({domain:"deterioro",severity:"CRITICAL",summary:`NEWS2 ${i.news2.score} (alto): riesgo de deterioro — escalar`});
  else if(i.news2.band==="MEDIUM")f.push({domain:"deterioro",severity:"WARNING",summary:`NEWS2 ${i.news2.score} (medio): vigilancia estrecha`});}
 if(i.egfr){const s=i.egfr.stage;if(s==="G5"||s==="G4")f.push({domain:"renal",severity:"WARNING",summary:`ERC ${s} (TFG ${i.egfr.egfr}): ajustar fármacos por función renal`});
  else if(s==="G3a"||s==="G3b")f.push({domain:"renal",severity:"WARNING",summary:`ERC ${s} (TFG ${i.egfr.egfr}): vigilar dosis renales`});}
 if(i.glycemic){if(i.glycemic.category==="POOR")f.push({domain:"glucémico",severity:"WARNING",summary:i.glycemic.label});
  else if(i.glycemic.category==="DIABETES_RANGE")f.push({domain:"glucémico",severity:"WARNING",summary:i.glycemic.label});
  else if(i.glycemic.category==="ABOVE_TARGET"||i.glycemic.category==="PREDIABETES")f.push({domain:"glucémico",severity:"INFO",summary:i.glycemic.label});}
 if(i.cha2ds2vasc&&i.cha2ds2vasc.applicable&&i.cha2ds2vasc.risk==="HIGH")f.push({domain:"anticoagulación",severity:"WARNING",summary:`CHA₂DS₂-VASc ${i.cha2ds2vasc.score} (alto): anticoagulación recomendada`});
 if(i.fib4&&i.fib4.risk==="HIGH")f.push({domain:"hepático",severity:"WARNING",summary:`FIB-4 ${i.fib4.value} (alto): referir a hepatología`});
 if(i.overdueVaccines&&i.overdueVaccines>0)f.push({domain:"inmunización",severity:"WARNING",summary:`${i.overdueVaccines} vacuna(s) vencida(s)`});
 if(i.bmi&&(i.bmi.category==="OBESITY_I"||i.bmi.category==="OBESITY_II"||i.bmi.category==="OBESITY_III"))f.push({domain:"nutricional",severity:"INFO",summary:`Obesidad (${i.bmi.category})`});
 return f.sort((a,b)=>RANK[a.severity]-RANK[b.severity]);
}
export function summarize(findings:readonly Finding[]){
 return{critical:findings.filter(x=>x.severity==="CRITICAL").length,warning:findings.filter(x=>x.severity==="WARNING").length,info:findings.filter(x=>x.severity==="INFO").length,total:findings.length};
}
