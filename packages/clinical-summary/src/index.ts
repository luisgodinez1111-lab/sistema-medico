// EPIC BS — Resumen de inteligencia clínica DETERMINISTA: consolida los cálculos por reglas (CDS por umbral,
// eGFR, NEWS2, glucémico, CHA2DS2-VASc, FIB-4, IMC, care gaps, obligaciones críticas) en una lista de hallazgos
// PRIORIZADA por severidad. Núcleo determinista (no IA generativa; R6 en pausa). Puro, sin PHI (recibe métricas).
export type Severity="CRITICAL"|"WARNING"|"INFO";
export type Finding=Readonly<{domain:string;severity:Severity;summary:string}>;
export type SummaryInputs=Readonly<{
 openCriticalResults?:number;
 openCriticalVitals?:number;
 news2?:{score:number;band:"LOW"|"MEDIUM"|"HIGH"|"INCOMPLETE";missing?:readonly string[]};
 egfr?:{egfr:number;stage:string};
 glycemic?:{category:string;label:string};
 cha2ds2vasc?:{score:number;risk:"LOW"|"INTERMEDIATE"|"HIGH";applicable:boolean};
 fib4?:{value:number;risk:"LOW"|"INDETERMINATE"|"HIGH"};
 bmi?:{category:string};
 overdueVaccines?:number;
 bp?:{stage:string};
 inr?:{status:string;onAnticoagulant:boolean};
}>;
const RANK:Record<Severity,number>={CRITICAL:0,WARNING:1,INFO:2};
// Ensambla y prioriza. Cada regla es explícita y determinista.
export function assembleFindings(i:SummaryInputs):Finding[]{
 const f:Finding[]=[];
 if(i.openCriticalResults&&i.openCriticalResults>0)f.push({domain:"resultados",severity:"CRITICAL",summary:`${i.openCriticalResults} resultado(s) crítico(s) sin cerrar`});
 if(i.openCriticalVitals&&i.openCriticalVitals>0)f.push({domain:"vitales",severity:"CRITICAL",summary:`${i.openCriticalVitals} signo(s) vital(es) crítico(s) sin atender`});
 if(i.news2){if(i.news2.band==="HIGH")f.push({domain:"deterioro",severity:"CRITICAL",summary:`NEWS2 ${i.news2.score}${i.news2.band==="HIGH"&&i.news2.missing?.length?"+":""} (alto): riesgo de deterioro — escalar`});
  else if(i.news2.band==="MEDIUM")f.push({domain:"deterioro",severity:"WARNING",summary:`NEWS2 ${i.news2.score}${i.news2.missing?.length?"+":""} (medio): vigilancia estrecha`});
  // Auditoría C-09: un NEWS2 incompleto NO es "riesgo bajo"; se dice qué falta.
  else if(i.news2.band==="INCOMPLETE")f.push({domain:"deterioro",severity:"INFO",summary:`NEWS2 incompleto (falta: ${(i.news2.missing??[]).join(", ")}): no se puede afirmar riesgo bajo`});}
 // Auditoría C-22: una creatinina da una categoría G PUNTUAL; "ERC" exige cronicidad (≥ 90 días), que aquí no se conoce.
 if(i.egfr){const s=i.egfr.stage;if(s==="G5"||s==="G4")f.push({domain:"renal",severity:"WARNING",summary:`TFG ${i.egfr.egfr} (${s}, puntual): ajustar fármacos por función renal y confirmar cronicidad`});
  else if(s==="G3a"||s==="G3b")f.push({domain:"renal",severity:"WARNING",summary:`TFG ${i.egfr.egfr} (${s}, puntual): vigilar dosis renales y confirmar cronicidad`});}
 if(i.glycemic){if(i.glycemic.category==="POOR")f.push({domain:"glucémico",severity:"WARNING",summary:i.glycemic.label});
  else if(i.glycemic.category==="DIABETES_RANGE")f.push({domain:"glucémico",severity:"WARNING",summary:i.glycemic.label});
  else if(i.glycemic.category==="ABOVE_TARGET"||i.glycemic.category==="PREDIABETES")f.push({domain:"glucémico",severity:"INFO",summary:i.glycemic.label});}
 if(i.cha2ds2vasc&&i.cha2ds2vasc.applicable&&i.cha2ds2vasc.risk==="HIGH")f.push({domain:"anticoagulación",severity:"WARNING",summary:`CHA₂DS₂-VASc ${i.cha2ds2vasc.score} (alto): anticoagulación recomendada`});
 if(i.fib4&&i.fib4.risk==="HIGH")f.push({domain:"hepático",severity:"WARNING",summary:`FIB-4 ${i.fib4.value} (alto): referir a hepatología`});
 if(i.bp){if(i.bp.stage==="CRISIS")f.push({domain:"presión",severity:"CRITICAL",summary:"Crisis hipertensiva: evaluación urgente"});
  else if(i.bp.stage==="HYPOTENSION_SEVERE")f.push({domain:"presión",severity:"CRITICAL",summary:"Hipotensión severa: evaluar perfusión de inmediato"}); // auditoría C-07
  else if(i.bp.stage==="HYPOTENSION")f.push({domain:"presión",severity:"WARNING",summary:"Hipotensión: correlacionar con síntomas, volemia y fármacos"});
  else if(i.bp.stage==="STAGE_2")f.push({domain:"presión",severity:"WARNING",summary:"Hipertensión estadio 2: ajustar tratamiento"});}
 if(i.inr){if(i.inr.status==="CRITICAL_HIGH")f.push({domain:"INR",severity:"CRITICAL",summary:"INR crítico (≥5): riesgo de hemorragia — suspender + vitamina K"});
  else if(i.inr.onAnticoagulant&&i.inr.status==="SUPRATHERAPEUTIC")f.push({domain:"INR",severity:"WARNING",summary:"INR supraterapéutico: riesgo hemorrágico — reducir dosis"});
  else if(i.inr.onAnticoagulant&&i.inr.status==="SUBTHERAPEUTIC")f.push({domain:"INR",severity:"WARNING",summary:"INR subterapéutico: riesgo trombótico — ajustar dosis"});}
 if(i.overdueVaccines&&i.overdueVaccines>0)f.push({domain:"inmunización",severity:"WARNING",summary:`${i.overdueVaccines} vacuna(s) vencida(s)`});
 if(i.bmi&&(i.bmi.category==="OBESITY_I"||i.bmi.category==="OBESITY_II"||i.bmi.category==="OBESITY_III"))f.push({domain:"nutricional",severity:"INFO",summary:`Obesidad (${i.bmi.category})`});
 return f.sort((a,b)=>RANK[a.severity]-RANK[b.severity]);
}
export function summarize(findings:readonly Finding[]){
 return{critical:findings.filter(x=>x.severity==="CRITICAL").length,warning:findings.filter(x=>x.severity==="WARNING").length,info:findings.filter(x=>x.severity==="INFO").length,total:findings.length};
}
