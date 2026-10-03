// EPIC BS — Resumen de inteligencia clínica DETERMINISTA: consolida los cálculos por reglas (CDS por umbral,
// eGFR, NEWS2, glucémico, CHA2DS2-VASc, FIB-4, IMC, care gaps, obligaciones críticas) en una lista de hallazgos
// PRIORIZADA por severidad. Núcleo determinista (no IA generativa; R6 en pausa). Puro, sin PHI (recibe métricas).
export type Severity="CRITICAL"|"WARNING"|"INFO";
export type Finding=Readonly<{domain:string;severity:Severity;summary:string}>;
export type SummaryInputs=Readonly<{
 openCriticalResults?:number;
 openCriticalVitals?:number;
 // R2B-009: `scored` es cuántos parámetros se pudieron puntuar, y `INSUFFICIENT` es «no hay score», distinto de
 // `INCOMPLETE` («hay score, con huecos»). Sin esa distinción, dos mediciones producían un veredicto con la misma forma
 // que siete.
 news2?:{score:number;band:"LOW"|"MEDIUM"|"HIGH"|"INCOMPLETE"|"INSUFFICIENT";missing?:readonly string[];scored?:number};
 egfr?:{egfr:number;stage:string};
 glycemic?:{category:string;label:string};
 cha2ds2vasc?:{score:number;risk:"LOW"|"INTERMEDIATE"|"HIGH";applicable:boolean;onAnticoagulant?:boolean};
 // HAS-BLED — riesgo de SANGRADO, para EQUILIBRAR la decisión de anticoagular (Pisters 2010). El caller lo marca
 // `show` cuando es relevante (paciente ya anticoagulado O con indicación de anticoagular), y pasa el score/riesgo ya
 // calculado. `minimum` es true si algún componente no fue evaluable (p. ej. INR lábil sin TTR): el score es un piso.
 hasBled?:{score:number;risk:"LOW"|"MODERATE"|"HIGH";show:boolean;minimum:boolean};
 // Calidad del control de la anticoagulación con VKA: tiempo en rango terapéutico (TTR, método Rosendaal). Solo cuando el
 // paciente está con antagonista de vitamina K y hay serie de INR suficiente para calcularlo.
 ttr?:{pct:number;points:number;labile:boolean;thresholdPct:number};
 // Brechas de terapia dirigida por guías (care gaps): el caller cruza condición+edad+labs+medicación activa (por CLASE
 // del catálogo) y aquí se enuncian como RECORDATORIOS de apoyo ("considere…"), nunca como mandato — el médico decide,
 // vigilando contraindicaciones. Solo se emiten cuando la terapia está INDICADA y el paciente NO la tiene activa.
 statinGap?:{indicated:boolean;onStatin:boolean;reason:string};
 reninAngiotensinGap?:{indicated:boolean;onTherapy:boolean;reason:string};
 diabetesMonitoringGap?:{dueHba1c:boolean};
 sglt2Gap?:{indicated:boolean;onSglt2:boolean;reason:string};
 antiplateletGap?:{indicated:boolean;onTherapy:boolean};
 // Combinación ACTIVA de riesgo (matriz de incompatibilidades LONGITUDINAL, distinta de la barrera al prescribir):
 tripleWhammy?:boolean; // IECA/ARA-II + diurético + AINE activos → riesgo de lesión renal aguda
 // Riesgos de la medicación ACTIVA cruzada con el estado del paciente (la barrera de Rx solo actúa al recetar; esto
 // vigila lo YA activo): hiperkalemia por doble bloqueo del potasio, metformina contraindicada por TFG, AINE en ERC.
 activeRisk?:{hyperkalemiaCombo?:boolean;metforminContraindicated?:boolean;nsaidInCkd?:boolean};
 // Escenarios priorizados por el dueño (Medicina General): adulto mayor (Beers), embarazo, pediatría, lípidos por meta.
 geriatric?:{beersActive:readonly string[];polypharmacy:boolean};              // ≥65: fármacos inapropiados + polifarmacia
 pregnancyRisk?:{teratogensActive:readonly string[];folateReminder:boolean};   // embarazo: teratógenos activos + ácido fólico
 pediatricRisk?:{reyeAspirin:boolean;growthDataMissing:boolean};               // <16: salicilato/Reye + peso/talla faltantes
 ldlTarget?:{value:number;target:number;riskLabel:string};                     // LDL por encima de la meta según riesgo
 fib4?:{value:number;risk:"LOW"|"INDETERMINATE"|"HIGH"};
 // Hepatopatía avanzada. MELD: gravedad/mortalidad, solo laboratorio → computable. Child-Pugh: requiere ascitis y
 // encefalopatía (clínicas); cuando se derivan de la lista de problemas (presente/ausente, sin grado) el resultado es un
 // PISO (`floor`) que el médico debe graduar — nunca un valor cerrado inventado.
 meld?:{score:number;risk:"LOW"|"MODERATE"|"HIGH"|"VERY_HIGH";version:string;mortalityPct:number};
 childPugh?:{score:number;childClass:"A"|"B"|"C";floor:boolean;ascitesPresent:boolean;encephalopathyPresent:boolean};
 bmi?:{category:string};
 overdueVaccines?:number;
 bp?:{stage:string};
 inr?:{status:string;onAnticoagulant:boolean};
 // Hábitos (antecedentes no patológicos). El motor los lee para EMITIR recordatorios de apoyo basados en guías; nunca
 // afirma un riesgo numérico que no puede calcular con un booleano (sin paquetes-año no se asume elegibilidad, se sugiere
 // confirmarla). Las elegibilidades por edad/sexo las resuelve el caller (CDS) y aquí solo se enuncian.
 habits?:{
  tabaquismo:boolean;alcoholismo:boolean;toxicomanias:boolean;
  cardiometabolic?:boolean;    // HTA/DM/dislipidemia activas: fumar multiplica el riesgo cardiovascular
  aaaScreenEligible?:boolean;  // varón 65-75 fumador: cribado único de aneurisma de aorta abdominal (USPSTF B)
  lungCancerScreenAge?:boolean;// 50-80 años: ventana de cribado de cáncer de pulmón (USPSTF B) si ≥20 paquetes-año
 };
}>;
const RANK:Record<Severity,number>={CRITICAL:0,WARNING:1,INFO:2};
// Ensambla y prioriza. Cada regla es explícita y determinista.
export function assembleFindings(i:SummaryInputs):Finding[]{
 const f:Finding[]=[];
 if(i.openCriticalResults&&i.openCriticalResults>0)f.push({domain:"resultados",severity:"CRITICAL",summary:`${i.openCriticalResults} resultado(s) crítico(s) sin cerrar`});
 if(i.openCriticalVitals&&i.openCriticalVitals>0)f.push({domain:"vitales",severity:"CRITICAL",summary:`${i.openCriticalVitals} signo(s) vital(es) crítico(s) sin atender`});
 if(i.news2){
  // R2B-009: el caveat se ESCRIBE. Antes el único indicio de un score parcial era un «+» pegado al número, que en una lista
  // de hallazgos no se lee. Ahora el texto dice cuántos parámetros lo sostienen y cuántos faltan.
  const faltan=(i.news2.missing??[]).length;
  const conCuantos=i.news2.scored!==undefined&&faltan>0?` [${i.news2.scored} de ${i.news2.scored+faltan} parámetros]`:"";
  if(i.news2.band==="HIGH")f.push({domain:"deterioro",severity:"CRITICAL",summary:`NEWS2 ${i.news2.score}${faltan?"+":""} (alto)${conCuantos}: riesgo de deterioro — escalar`});
  else if(i.news2.band==="MEDIUM")f.push({domain:"deterioro",severity:"WARNING",summary:`NEWS2 ${i.news2.score}${faltan?"+":""} (medio)${conCuantos}: vigilancia estrecha`});
  // Auditoría C-09: un NEWS2 incompleto NO es "riesgo bajo"; se dice qué falta.
  else if(i.news2.band==="INCOMPLETE")f.push({domain:"deterioro",severity:"INFO",summary:`NEWS2 incompleto (falta: ${(i.news2.missing??[]).join(", ")}): no se puede afirmar riesgo bajo`});
  // R2B-009: por debajo del mínimo de parámetros no hay score que presentar, y decirlo es el hallazgo.
  else if(i.news2.band==="INSUFFICIENT")f.push({domain:"deterioro",severity:"INFO",
   summary:`NEWS2 no calculable: solo ${i.news2.scored??0} de ${(i.news2.scored??0)+faltan} parámetros medidos (falta: ${(i.news2.missing??[]).join(", ")})`});}
 // Auditoría C-22: una creatinina da una categoría G PUNTUAL; "ERC" exige cronicidad (≥ 90 días), que aquí no se conoce.
 if(i.egfr){const s=i.egfr.stage;if(s==="G5"||s==="G4")f.push({domain:"renal",severity:"WARNING",summary:`TFG ${i.egfr.egfr} (${s}, puntual): ajustar fármacos por función renal y confirmar cronicidad`});
  else if(s==="G3a"||s==="G3b")f.push({domain:"renal",severity:"WARNING",summary:`TFG ${i.egfr.egfr} (${s}, puntual): vigilar dosis renales y confirmar cronicidad`});}
 if(i.glycemic){if(i.glycemic.category==="POOR")f.push({domain:"glucémico",severity:"WARNING",summary:i.glycemic.label});
  else if(i.glycemic.category==="DIABETES_RANGE")f.push({domain:"glucémico",severity:"WARNING",summary:i.glycemic.label});
  else if(i.glycemic.category==="ABOVE_TARGET"||i.glycemic.category==="PREDIABETES")f.push({domain:"glucémico",severity:"INFO",summary:i.glycemic.label});}
 // FA + riesgo alto SIN anticoagulación = brecha; si ya está anticoagulado no se avisa (no se repregunta lo ya resuelto).
 if(i.cha2ds2vasc&&i.cha2ds2vasc.applicable&&i.cha2ds2vasc.risk==="HIGH"&&i.cha2ds2vasc.onAnticoagulant!==true)f.push({domain:"anticoagulación",severity:"WARNING",summary:`CHA₂DS₂-VASc ${i.cha2ds2vasc.score} (alto) en fibrilación auricular sin anticoagulación activa: considere anticoagular salvo contraindicación (ESC/AHA).`});
 // Balance de la anticoagulación: junto al riesgo trombótico (CHA₂DS₂-VASc) se enuncia el riesgo de SANGRADO (HAS-BLED)
 // para una decisión EQUILIBRADA, no unilateral. Un HAS-BLED alto NO contraindica anticoagular: obliga a corregir los
 // factores modificables y vigilar de cerca (Pisters 2010). El caller decide `show` (relevante si ya anticoagulado o con
 // indicación). `minimum` avisa que el score es un piso cuando un componente (p. ej. INR lábil) no pudo evaluarse.
 if(i.hasBled?.show){const piso=i.hasBled.minimum?" (mínimo: hay componentes no evaluados, p. ej. INR lábil)":"";
  if(i.hasBled.risk==="HIGH")f.push({domain:"anticoagulación",severity:"WARNING",summary:`Riesgo hemorrágico ALTO (HAS-BLED ${i.hasBled.score}${piso}): NO contraindica anticoagular — corrija los factores modificables (presión, antiagregantes/AINE, alcohol, INR) y vigile de cerca (Pisters 2010).`});
  else f.push({domain:"anticoagulación",severity:"INFO",summary:`Riesgo hemorrágico ${i.hasBled.risk==="MODERATE"?"moderado":"bajo"} (HAS-BLED ${i.hasBled.score}${piso}): téngalo en el balance al decidir la anticoagulación (Pisters 2010).`});}
 // Calidad del control con VKA: un TTR bajo (método Rosendaal) indica anticoagulación inestable → más riesgo trombótico Y
 // hemorrágico; obliga a revisar adherencia, interacciones y dieta, o a valorar un ACOD (Rosendaal 1993; ESC 2024 busca
 // TTR >70%). También es el componente "INR lábil" del HAS-BLED, que así deja de ser no evaluable.
 if(i.ttr){
  if(i.ttr.labile)f.push({domain:"anticoagulación",severity:"WARNING",summary:`Control de la anticoagulación INESTABLE: tiempo en rango terapéutico ${i.ttr.pct}% (<${i.ttr.thresholdPct}%, ${i.ttr.points} determinaciones de INR): revise adherencia, interacciones y dieta, o valore cambiar a un ACOD (Rosendaal; ESC 2024 busca >70%).`});
  else f.push({domain:"anticoagulación",severity:"INFO",summary:`Control de la anticoagulación aceptable: tiempo en rango terapéutico ${i.ttr.pct}% (${i.ttr.points} determinaciones de INR; objetivo ESC 2024 >70%).`});
 }
 // — Brechas de terapia dirigida por guías (GDMT): recordatorios de apoyo, el médico decide —
 if(i.statinGap?.indicated&&!i.statinGap.onStatin)f.push({domain:"lípidos",severity:"WARNING",summary:`${i.statinGap.reason}: sin estatina activa — considere iniciar estatina salvo contraindicación (ACC/AHA 2018; ADA Standards of Care).`});
 if(i.reninAngiotensinGap?.indicated&&!i.reninAngiotensinGap.onTherapy)f.push({domain:"cardiorrenal",severity:"INFO",summary:`${i.reninAngiotensinGap.reason}: considere IECA/ARA-II por su efecto cardio/nefroprotector, vigilando potasio, creatinina y contraindicaciones (KDIGO; ACC/AHA).`});
 if(i.diabetesMonitoringGap?.dueHba1c)f.push({domain:"glucémico",severity:"INFO",summary:"Diabetes sin HbA1c vigente: solicite HbA1c para evaluar el control (ADA: cada 3–6 meses según estabilidad)."});
 if(i.sglt2Gap?.indicated&&!i.sglt2Gap.onSglt2)f.push({domain:"cardiorrenal",severity:"INFO",summary:`${i.sglt2Gap.reason}: considere un iSGLT2 por su beneficio cardiorrenal independiente del control glucémico, vigilando TFG y riesgo de cetoacidosis (ADA; KDIGO).`});
 if(i.antiplateletGap?.indicated&&!i.antiplateletGap.onTherapy)f.push({domain:"antiagregación",severity:"INFO",summary:"Enfermedad cardiovascular aterosclerótica sin antiagregante ni anticoagulante activo: considere antiagregación en prevención secundaria salvo contraindicación (ACC/AHA)."});
 if(i.tripleWhammy)f.push({domain:"renal",severity:"WARNING",summary:`Combinación activa IECA/ARA-II + diurético + AINE ("triple whammy"): riesgo de lesión renal aguda — revise la necesidad del AINE y vigile la función renal (KDIGO; farmacovigilancia).`});
 if(i.activeRisk?.hyperkalemiaCombo)f.push({domain:"electrolitos",severity:"WARNING",summary:"IECA/ARA-II + ahorrador de potasio activos: riesgo de hiperkalemia — vigile el potasio sérico (ACC/AHA; KDIGO)."});
 if(i.activeRisk?.metforminContraindicated)f.push({domain:"renal",severity:"WARNING",summary:"Metformina activa con TFG<30: contraindicada por riesgo de acidosis láctica — suspender y reevaluar el antidiabético (ficha técnica FDA; KDIGO)."});
 if(i.activeRisk?.nsaidInCkd)f.push({domain:"renal",severity:"WARNING",summary:"AINE activo con enfermedad renal (TFG<60): nefrotóxico — revise la necesidad y valore alternativas (KDIGO)."});
 if(i.geriatric){
  if(i.geriatric.beersActive.length)f.push({domain:"geriatría",severity:"WARNING",summary:`Adulto mayor con fármaco(s) potencialmente inapropiado(s) (criterios Beers, AGS 2023): ${i.geriatric.beersActive.join(", ")} — revise riesgo/beneficio y alternativas más seguras.`});
  if(i.geriatric.polypharmacy)f.push({domain:"geriatría",severity:"INFO",summary:"Polifarmacia (≥5 fármacos activos): considere conciliación de la medicación y deprescripción."});
 }
 if(i.pregnancyRisk){
  if(i.pregnancyRisk.teratogensActive.length)f.push({domain:"embarazo",severity:"WARNING",summary:`Embarazo con fármaco(s) teratogénico(s) ACTIVO(s): ${i.pregnancyRisk.teratogensActive.join(", ")} — contraindicado(s): suspender y cambiar a una opción segura (ficha técnica; fetotoxicidad documentada).`});
  if(i.pregnancyRisk.folateReminder)f.push({domain:"embarazo",severity:"INFO",summary:"Embarazo: confirme la suplementación con ácido fólico (prevención de defectos del tubo neural)."});
 }
 if(i.pediatricRisk){
  if(i.pediatricRisk.reyeAspirin)f.push({domain:"pediatría",severity:"WARNING",summary:"Aspirina/salicilato en menor de 16 años: riesgo de síndrome de Reye — evitar salvo indicación específica (p. ej. enfermedad de Kawasaki)."});
  if(i.pediatricRisk.growthDataMissing)f.push({domain:"pediatría",severity:"INFO",summary:"Pediatría sin peso/talla registrados: captúrelos para evaluar crecimiento (percentiles/Z de la OMS)."});
 }
 if(i.ldlTarget)f.push({domain:"lípidos",severity:"WARNING",summary:`LDL ${i.ldlTarget.value} mg/dL por encima de la meta (<${i.ldlTarget.target}) para ${i.ldlTarget.riskLabel}: intensifique el tratamiento hipolipemiante (ACC/AHA; ESC/EAS).`});
 if(i.fib4&&i.fib4.risk==="HIGH")f.push({domain:"hepático",severity:"WARNING",summary:`FIB-4 ${i.fib4.value} (alto): referir a hepatología`});
 // MELD — gravedad de la hepatopatía avanzada (bilirrubina+INR+creatinina). Pronóstico, NO asignación de trasplante.
 if(i.meld){
  if(i.meld.risk==="HIGH"||i.meld.risk==="VERY_HIGH")f.push({domain:"hepático",severity:"WARNING",summary:`MELD ${i.meld.score} (${i.meld.risk==="VERY_HIGH"?"muy alto":"alto"}): hepatopatía avanzada — ~${i.meld.mortalityPct}% de mortalidad a 3 meses (Wiesner 2003); evalúe derivación a hepatología. Pronóstico, NO asignación de trasplante.`});
  else f.push({domain:"hepático",severity:"INFO",summary:`MELD ${i.meld.score} (${i.meld.risk==="MODERATE"?"moderado":"bajo"}): seguimiento de la hepatopatía (pronóstico; NO asignación de trasplante).`});
 }
 // Child-Pugh — clase de la hepatopatía crónica. Si ascitis/encefalopatía se derivaron de la lista de problemas (floor),
 // se dice explícitamente que es un PISO a graduar en la exploración (nunca una clase cerrada sin el dato clínico).
 if(i.childPugh){
  const cp=i.childPugh;const nota=cp.floor?` — estimación de PISO: ascitis ${cp.ascitesPresent?"documentada":"no documentada"} y encefalopatía ${cp.encephalopathyPresent?"documentada":"no documentada"} sin graduar; gradúelas en la exploración para precisar la clase (puede ser mayor)`:"";
  if(cp.childClass==="B"||cp.childClass==="C")f.push({domain:"hepático",severity:"WARNING",summary:`Child-Pugh ${cp.childClass} (${cp.score} puntos): descompensación — ajuste fármacos de metabolismo hepático y extreme la cautela perioperatoria (Pugh 1973)${nota}.`});
  else f.push({domain:"hepático",severity:"INFO",summary:`Child-Pugh ${cp.childClass} (${cp.score} puntos): hepatopatía compensada (Pugh 1973)${nota}.`});
 }
 if(i.bp){if(i.bp.stage==="CRISIS")f.push({domain:"presión",severity:"CRITICAL",summary:"Crisis hipertensiva: evaluación urgente"});
  else if(i.bp.stage==="HYPOTENSION_SEVERE")f.push({domain:"presión",severity:"CRITICAL",summary:"Hipotensión severa: evaluar perfusión de inmediato"}); // auditoría C-07
  else if(i.bp.stage==="HYPOTENSION")f.push({domain:"presión",severity:"WARNING",summary:"Hipotensión: correlacionar con síntomas, volemia y fármacos"});
  else if(i.bp.stage==="STAGE_2")f.push({domain:"presión",severity:"WARNING",summary:"Hipertensión estadio 2: ajustar tratamiento"});}
 if(i.inr){if(i.inr.status==="CRITICAL_HIGH")f.push({domain:"INR",severity:"CRITICAL",summary:"INR crítico (≥5): riesgo de hemorragia — suspender + vitamina K"});
  else if(i.inr.onAnticoagulant&&i.inr.status==="SUPRATHERAPEUTIC")f.push({domain:"INR",severity:"WARNING",summary:"INR supraterapéutico: riesgo hemorrágico — reducir dosis"});
  else if(i.inr.onAnticoagulant&&i.inr.status==="SUBTHERAPEUTIC")f.push({domain:"INR",severity:"WARNING",summary:"INR subterapéutico: riesgo trombótico — ajustar dosis"});}
 if(i.overdueVaccines&&i.overdueVaccines>0)f.push({domain:"inmunización",severity:"WARNING",summary:`${i.overdueVaccines} vacuna(s) vencida(s)`});
 if(i.bmi&&(i.bmi.category==="OBESITY_I"||i.bmi.category==="OBESITY_II"||i.bmi.category==="OBESITY_III"))f.push({domain:"nutricional",severity:"INFO",summary:`Obesidad (${i.bmi.category})`});
 // Hábitos (antecedentes). Recordatorios de APOYO basados en guías; el médico decide. Se escalan a WARNING solo cuando el
 // hábito se suma a un riesgo ya presente (p. ej. tabaquismo + enfermedad cardiometabólica). Nunca se inventan cifras.
 if(i.habits){
  const h=i.habits;
  if(h.tabaquismo){
   if(h.cardiometabolic)f.push({domain:"tabaquismo",severity:"WARNING",summary:"Tabaquismo activo con riesgo cardiometabólico: la cesación es la intervención de mayor impacto en el riesgo cardiovascular; ofrezca consejo y tratamiento."});
   else f.push({domain:"tabaquismo",severity:"INFO",summary:"Tabaquismo activo: ofrezca consejo de cesación e intervención breve (USPSTF A)."});
   if(h.aaaScreenEligible)f.push({domain:"tabaquismo",severity:"INFO",summary:"Varón fumador de 65-75 años: considere cribado único de aneurisma de aorta abdominal con ecografía (USPSTF B)."});
   if(h.lungCancerScreenAge)f.push({domain:"tabaquismo",severity:"INFO",summary:"Fumador de 50-80 años: valore cribado de cáncer de pulmón con TC de baja dosis si ≥20 paquetes-año (USPSTF B); confirme el consumo acumulado."});
  }
  if(h.alcoholismo)f.push({domain:"alcohol",severity:"INFO",summary:"Consumo de alcohol referido: aplique cribado (AUDIT-C) e intervención breve (USPSTF B); valore riesgo hepático e interacciones."});
  if(h.toxicomanias)f.push({domain:"adicciones",severity:"INFO",summary:"Toxicomanías referidas: valore interacciones, riesgo infeccioso asociado y derivación a tratamiento."});
 }
 return f.sort((a,b)=>RANK[a.severity]-RANK[b.severity]);
}
export function summarize(findings:readonly Finding[]){
 return{critical:findings.filter(x=>x.severity==="CRITICAL").length,warning:findings.filter(x=>x.severity==="WARNING").length,info:findings.filter(x=>x.severity==="INFO").length,total:findings.length};
}
