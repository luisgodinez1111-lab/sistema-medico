import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{patientDemographics,latestVitalsByType,activeProblemCodes,activeAllergySubstances,countOpenCriticalResults,countOpenCriticalVitals,administeredVaccines,activeMedicationDrugCodes,antecedentes,analyteSeries}from"./clinical-runtime";
import{verifiedValues,MAX_AGE_DAYS,COHERENCE_HOURS}from"./analyte-inputs";
import{stageBloodPressure,parseBp}from"../../../packages/bp-staging/src";
import{interpretINR,timeInTherapeuticRange,INR_TARGETS}from"../../../packages/anticoagulation/src";
import{resolveDrug}from"../../../packages/drug-catalog/src";
import{computeEGFR,type Sex}from"../../../packages/renal-function/src";
import{computeNEWS2,news2ScoredCount,NEWS2_MIN_SCORED_PARAMS}from"../../../packages/lab-reference/src";
import{glycemicAssessment}from"../../../packages/glycemic/src";
import{cha2ds2vasc}from"../../../packages/stroke-risk/src";
import{hasBled}from"../../../packages/bleeding-risk/src";
import{fib4}from"../../../packages/liver-fibrosis/src";
import{bmiFromVitals}from"../../../packages/anthropometrics/src";
import{forecastImmunizations,forecastSummary}from"../../../packages/immunization-schedule/src";
import{assembleFindings,summarize,type SummaryInputs,type Finding}from"../../../packages/clinical-summary/src";
// EPIC BS — Reúne los datos del paciente (RLS-scoped) y computa los CDS deterministas; delega la priorización
// al agregador puro (packages/clinical-summary). Núcleo determinista (no IA generativa; R6 en pausa).
function num(s:string|undefined):number|undefined{if(s===undefined)return undefined;const n=Number(String(s).trim());return Number.isFinite(n)?n:undefined;}
function ageYears(bd:string):number{const b=new Date(bd),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y;}
const has=(codes:string[],...p:string[])=>codes.some(c=>{const u=c.trim().toUpperCase();return p.some(x=>u.startsWith(x));});

export async function gatherClinicalIntelligence(ctx:HttpTenantContext,patientId:string):Promise<{registered:boolean;findings:Finding[];summary:ReturnType<typeof summarize>}>{
 const demo=await patientDemographics(ctx,patientId);
 if(!demo?.birthDate)return{registered:false,findings:[],summary:summarize([])};
 const asOf=new Date().toISOString();
 const age=ageYears(demo.birthDate);
 const sex=demo.sexAtBirth;
 // Auditoría 2026-09-19 (C-01, C-02): este panel usa el MISMO camino verificado que las calculadoras (unidad canónica,
 // plausibilidad, vigencia y coherencia de muestra). Antes leía "el último número" sin unidad ni fecha, de modo que el
 // panel podía afirmar un eGFR o un FIB-4 que la propia calculadora ya se negaba a calcular. Dato no utilizable => sin hallazgo.
 const[vitals,codes,openRes,openVit,vaccines,renal,glyc,liver,anticoag,activeDrugs,ant,lipid,inrSeries]=await Promise.all([
  latestVitalsByType(ctx,patientId),
  activeProblemCodes(ctx,patientId),
  countOpenCriticalResults(ctx,patientId),
  countOpenCriticalVitals(ctx,patientId),
  administeredVaccines(ctx,patientId),
  verifiedValues(ctx,patientId,["CREATININE"],MAX_AGE_DAYS.RENAL_FUNCTION),
  verifiedValues(ctx,patientId,["HBA1C"],MAX_AGE_DAYS.GLYCEMIC_CONTROL),
  verifiedValues(ctx,patientId,["AST","ALT","PLATELETS"],MAX_AGE_DAYS.LIVER_PANEL,COHERENCE_HOURS.LIVER_PANEL),
  verifiedValues(ctx,patientId,["INR"],MAX_AGE_DAYS.ANTICOAGULATION),
  activeMedicationDrugCodes(ctx,patientId),
  antecedentes(ctx,patientId), // hábitos (antecedentes no patológicos) para los recordatorios por guías
  verifiedValues(ctx,patientId,["LDL"],MAX_AGE_DAYS.GLYCEMIC_CONTROL), // LDL para la meta por riesgo (cardiometabólico)
  analyteSeries(ctx,patientId,"INR"), // serie para el TTR (calidad del control de la anticoagulación con VKA)
 ]);
 const inp:{-readonly[K in keyof SummaryInputs]:SummaryInputs[K]}={openCriticalResults:openRes,openCriticalVitals:openVit};
 // NEWS2
 const sbp=vitals["BP"]?parseBp(vitals["BP"])?.systolic:undefined; // C-21: parser único
 // Auditoría C-09: NEWS2 solo en adultos; el O₂ suplementario y la conciencia no se registran como signos vitales -> el
 // resultado queda INCOMPLETE salvo que ya sea HIGH/MEDIUM con lo disponible (nunca "bajo" por datos ausentes).
 // R2B-009 (lote 18): el filtro era `missing.length<7`, es decir, bastaba UN parámetro medido para registrar un score. Un
 // NEWS2 calculado con dos mediciones se presentaba igual que uno completo, y un score bajo por falta de datos se lee igual
 // que un score bajo real. Ahora se exige el mínimo declarado por el propio motor y se informa CUÁNTOS se puntuaron, para
 // que el texto que ve el clínico pueda decirlo en vez de insinuarlo con un «+».
 if(age>=16){const n2=computeNEWS2({resp:num(vitals["RESP"]),spo2:num(vitals["SPO2"]),temp:num(vitals["TEMP"]),hr:num(vitals["HR"]),sbp});
  const medidos=news2ScoredCount(n2);
  if(medidos>=NEWS2_MIN_SCORED_PARAMS)inp.news2={score:n2.score,band:n2.band,missing:n2.missing,scored:medidos};
  // Con CERO parámetros medidos no hay nada que decir: a ese paciente no le han tomado signos vitales, y anunciar «NEWS2 no
  // calculable» en cada expediente sin vitales es ruido que entierra los hallazgos reales. La advertencia importa cuando SÍ
  // se midió algo —ahí un lector podría leer el score como tranquilizador— y por eso solo entonces se emite.
  else if(medidos>0)inp.news2={score:n2.score,band:"INSUFFICIENT",missing:n2.missing,scored:medidos};}
 // eGFR
 const creat=renal?.["CREATININE"];
 if(age>=18&&(sex==="FEMALE"||sex==="MALE")&&creat!==undefined){const e=computeEGFR(creat,age,sex as Sex);if(e)inp.egfr={egfr:e.egfr,stage:e.stage};}
 // Glucémico
 const a1c=glyc?.["HBA1C"];
 if(a1c!==undefined){const g=glycemicAssessment(a1c,has(codes,"E10","E11"));if(g)inp.glycemic={category:g.category,label:g.label};}
 // CHA2DS2-VASc
 const cv=cha2ds2vasc({ageYears:age,female:sex==="FEMALE",chf:has(codes,"I50"),hypertension:has(codes,"I10"),diabetes:has(codes,"E10","E11"),strokeHistory:has(codes,"I63","G45","I64"),vascularDisease:has(codes,"I25","I21","I73")});
 if(cv)inp.cha2ds2vasc={score:cv.score,risk:cv.risk,applicable:has(codes,"I48")};
 // FIB-4
 if(liver){const fr=fib4(age,liver["AST"]!,liver["ALT"]!,liver["PLATELETS"]!);if(fr)inp.fib4={value:fr.value,risk:fr.risk};}
 // IMC
 const b=bmiFromVitals({value:vitals["WEIGHT"]},{value:vitals["HEIGHT"]}); // C-21: implementación única (unidad de talla inferida: latestVitalsByType no la trae)
 if(b)inp.bmi={category:b.category};
 // Vacunas vencidas (solo pediatría tiene esquema aquí)
 // Auditoría C-10: el pronóstico ya distingue ventanas de edad (NOT_APPLICABLE no cuenta): vale para todas las edades.
 {const fc=forecastImmunizations(demo.birthDate,vaccines,asOf);inp.overdueVaccines=forecastSummary(fc).overdue;}
 // Presión arterial (estadificación ACC/AHA)
 const bpv=vitals["BP"];if(bpv){const pb=parseBp(bpv);if(pb){const bs=stageBloodPressure(pb.systolic,pb.diastolic);if(bs)inp.bp={stage:bs.stage};}}
 // INR (contexto del anticoagulante activo)
 const inrV=anticoag?.["INR"];
 if(inrV!==undefined){const ir=interpretINR(inrV);if(ir)inp.inr={status:ir.status,onAnticoagulant:activeDrugs.some(dc=>resolveDrug(dc)?.classes.includes("ANTICOAGULANT"))};}
 // TTR (tiempo en rango terapéutico, Rosendaal) — calidad del control de la anticoagulación con ANTAGONISTA DE VITAMINA K.
 // Solo con VKA activo (el INR no monitoriza a los ACOD) y serie de INR suficiente; de lo contrario queda sin calcular.
 const onVka=activeDrugs.some(dc=>resolveDrug(dc)?.classes.includes("VKA"));
 // Rango objetivo según la indicación: válvula mecánica 2.5–3.5 (Z95.2/Z95.4), resto 2.0–3.0.
 const inrTarget=has(codes,"Z95.2","Z95.4")?INR_TARGETS.MECHANICAL_VALVE:INR_TARGETS.AF_OR_VTE;
 const ttr=onVka?timeInTherapeuticRange({readings:inrSeries,target:inrTarget}):undefined;
 if(ttr)inp.ttr={pct:ttr.ttrPct,points:ttr.points,labile:ttr.labile,thresholdPct:ttr.labileThresholdPct};
 // Hábitos (antecedentes no patológicos): recordatorios de apoyo basados en guías. Las elegibilidades por edad/sexo se
 // resuelven aquí (el agregador es puro). Con un booleano NO se asume elegibilidad de cribado que exige paquetes-año: se
 // sugiere confirmarla. Solo si hay antecedentes capturados.
 if(ant.recorded){
  const hab=(ant.content as{noPatologicos?:{tabaquismo?:unknown;alcoholismo?:unknown;toxicomanias?:unknown}}).noPatologicos;
  const tabaquismo=hab?.tabaquismo===true,alcoholismo=hab?.alcoholismo===true,toxicomanias=hab?.toxicomanias===true;
  if(tabaquismo||alcoholismo||toxicomanias){
   const cardiometabolic=has(codes,"I10")||has(codes,"E10","E11")||has(codes,"E78"); // HTA, diabetes, dislipidemia activas
   inp.habits={tabaquismo,alcoholismo,toxicomanias,cardiometabolic,
    aaaScreenEligible:tabaquismo&&sex==="MALE"&&age>=65&&age<=75,
    lungCancerScreenAge:tabaquismo&&age>=50&&age<=80};
  }
 }
 // — Brechas de terapia dirigida por guías (GDMT): se cruzan condición+edad+TFG con las CLASES de la medicación ACTIVA
 // (vía el catálogo de seguridad) para detectar terapia indicada y ausente. Determinista y con fuente; son recordatorios
 // de apoyo ("considere…"), nunca mandato. "Activo en clase X" = el paciente ya toma un fármaco de esa clase.
 const activeClasses=new Set<string>(activeDrugs.flatMap(dc=>resolveDrug(dc)?.classes??[]));
 const dm=has(codes,"E10","E11");
 const ascvd=has(codes,"I20","I21","I22","I24","I25","I63","I64","I70","I73","G45"); // cardiopatía isquémica, EVC, art. periférica
 const pregnant=has(codes,"O","Z34","Z33","Z35","Z36"); // no sugerir IECA/ARA-II en embarazo (fetotóxicos)
 // Estatina: ASCVD (prevención secundaria) o diabetes 40–75 años.
 if(ascvd||(dm&&age>=40&&age<=75))inp.statinGap={indicated:true,onStatin:activeClasses.has("STATIN"),reason:ascvd?"Enfermedad cardiovascular aterosclerótica":"Diabetes en 40–75 años"};
 // IECA/ARA-II: insuficiencia cardíaca o diabetes con TFG<60 (nefroprotección), fuera del embarazo.
 const hf=has(codes,"I50");const ckd=inp.egfr!==undefined&&inp.egfr.egfr<60;
 if(!pregnant&&(hf||(dm&&ckd)))inp.reninAngiotensinGap={indicated:true,onTherapy:activeClasses.has("ACE_INHIBITOR")||activeClasses.has("ARB"),reason:hf?"Insuficiencia cardíaca":"Diabetes con TFG<60"};
 // Diabetes sin HbA1c vigente (no se pudo leer un valor dentro de la ventana): recordatorio de monitoreo.
 if(dm&&a1c===undefined)inp.diabetesMonitoringGap={dueHba1c:true};
 // iSGLT2: DM TIPO 2 con insuficiencia cardíaca, ERC o ASCVD (beneficio cardiorrenal independiente de la glucemia).
 // Solo si la TFG permite iniciar (≥20) o es desconocida; restringido a DM2 (E11) por el riesgo de cetoacidosis en DM1.
 const t2dm=has(codes,"E11");const egfrOkForSglt2=inp.egfr===undefined||inp.egfr.egfr>=20;
 if(t2dm&&egfrOkForSglt2&&(hf||ckd||ascvd))inp.sglt2Gap={indicated:true,onSglt2:activeClasses.has("SGLT2_INHIBITOR"),reason:hf?"Diabetes tipo 2 con insuficiencia cardíaca":ckd?"Diabetes tipo 2 con TFG<60":"Diabetes tipo 2 con enfermedad cardiovascular"};
 // Antiagregante en ASCVD (prevención secundaria), salvo que ya esté antiagregado o anticoagulado.
 if(ascvd)inp.antiplateletGap={indicated:true,onTherapy:activeClasses.has("ANTIPLATELET")||activeClasses.has("ANTICOAGULANT")};
 // "Triple whammy": IECA/ARA-II + diurético + AINE ACTIVOS a la vez → riesgo de lesión renal aguda.
 const onRaas=activeClasses.has("ACE_INHIBITOR")||activeClasses.has("ARB");
 const onDiuretic=activeClasses.has("LOOP_DIURETIC")||activeClasses.has("THIAZIDE");
 if(onRaas&&onDiuretic&&activeClasses.has("NSAID"))inp.tripleWhammy=true;
 // Riesgos de la medicación ACTIVA × estado del paciente (vigila lo ya activo; complementa la barrera de prescripción).
 const egfrVal=inp.egfr?.egfr;const ar:{hyperkalemiaCombo?:boolean;metforminContraindicated?:boolean;nsaidInCkd?:boolean}={};
 if(onRaas&&activeClasses.has("POTASSIUM_SPARING"))ar.hyperkalemiaCombo=true;
 if(activeClasses.has("BIGUANIDE")&&egfrVal!==undefined&&egfrVal<30)ar.metforminContraindicated=true;
 if(activeClasses.has("NSAID")&&egfrVal!==undefined&&egfrVal<60)ar.nsaidInCkd=true;
 if(Object.keys(ar).length)inp.activeRisk=ar;
 // FA: contexto del anticoagulante activo para la brecha de anticoagulación.
 if(inp.cha2ds2vasc)inp.cha2ds2vasc={...inp.cha2ds2vasc,onAnticoagulant:activeClasses.has("ANTICOAGULANT")};
 // HAS-BLED — riesgo de SANGRADO para EQUILIBRAR la anticoagulación (Pisters 2010). Se calcula y muestra SOLO cuando es
 // relevante: el paciente ya está anticoagulado O tiene indicación de anticoagular (FA con CHA₂DS₂-VASc alto). Cada
 // componente es factual, de los datos disponibles; el INR lábil NO es evaluable sin TTR → se deja `undefined` (no se
 // inventa el punto) y el score se reporta como MÍNIMO. El consumo de alcohol usa el hábito registrado como aproximación.
 const onAnticoag=activeClasses.has("ANTICOAGULANT");
 const anticoagIndicated=inp.cha2ds2vasc?.applicable===true&&inp.cha2ds2vasc.risk==="HIGH";
 if(onAnticoag||anticoagIndicated){
  const alcoholHabit=ant.recorded&&(ant.content as{noPatologicos?:{alcoholismo?:unknown}}).noPatologicos?.alcoholismo===true;
  const hb=hasBled({
   hypertensionUncontrolled:sbp!==undefined&&sbp>160,
   abnormalRenal:(creat!==undefined&&creat>2.26)||(egfrVal!==undefined&&egfrVal<30)||has(codes,"N18.6","Z99.2"),
   abnormalLiver:has(codes,"K70","K71","K72","K74","K76")||inp.fib4?.risk==="HIGH",
   strokeHistory:has(codes,"I63","I64","G45"),
   bleedingHistory:has(codes,"I60","I61","I62","K92","D62"), // hemorragia intracraneal/digestiva, anemia poshemorrágica
   labileINR:ttr?ttr.labile:undefined, // del TTR (Rosendaal) si es calculable; si no, sin puntuar (score mínimo)
   elderly:age>65,
   drugsAntiplateletOrNsaid:activeClasses.has("ANTIPLATELET")||activeClasses.has("NSAID"),
   alcoholExcess:alcoholHabit===true,
  });
  inp.hasBled={score:hb.score,risk:hb.risk,show:true,minimum:hb.notAssessed.length>0};
 }
 // — Escenarios priorizados: adulto mayor (Beers), embarazo, pediatría, lípidos por meta de riesgo —
 if(age>=65){
  const beers:string[]=[];
  if(activeClasses.has("BENZODIAZEPINE"))beers.push("benzodiacepina");
  if(activeClasses.has("NSAID"))beers.push("AINE");
  if(activeClasses.has("TCA"))beers.push("antidepresivo tricíclico (anticolinérgico)");
  if(activeClasses.has("SULFONYLUREA"))beers.push("sulfonilurea");
  const poly=activeDrugs.length>=5;
  if(beers.length||poly)inp.geriatric={beersActive:beers,polypharmacy:poly};
 }
 if(pregnant){
  const terat:string[]=[];
  if(activeClasses.has("ACE_INHIBITOR")||activeClasses.has("ARB"))terat.push("IECA/ARA-II");
  if(activeClasses.has("STATIN"))terat.push("estatina");
  if(activeClasses.has("VKA"))terat.push("warfarina/acenocumarol");
  inp.pregnancyRisk={teratogensActive:terat,folateReminder:true};
 }
 if(age<16){
  const reye=activeClasses.has("SALICYLATE");
  const growthDataMissing=!vitals["WEIGHT"]||!vitals["HEIGHT"];
  if(reye||growthDataMissing)inp.pediatricRisk={reyeAspirin:reye,growthDataMissing};
 }
 const ldlv=lipid?.["LDL"];
 if(ldlv!==undefined){
  if(ascvd&&ldlv>70)inp.ldlTarget={value:ldlv,target:70,riskLabel:"riesgo muy alto (enfermedad cardiovascular aterosclerótica)"};
  else if(dm&&ldlv>100)inp.ldlTarget={value:ldlv,target:100,riskLabel:"riesgo alto (diabetes)"};
 }
 const findings=assembleFindings(inp);
 return{registered:true,findings,summary:summarize(findings)};
}

// EPIC CF — Snapshot de consulta (panel "Vista principal – Durante la consulta"). Reúne demografía +
// valores clínicos actuales + problemas/alergias + los findings deterministas del motor CDS. Núcleo
// determinista (R6 en pausa: sin IA generativa). PHI cruda -> endpoint autorizado (patient:read/TREATMENT).
export type ConsultationSnapshot=
 |{registered:false}
 |{registered:true;demographics:{age:number;sex:string;birthDate:string;name?:string;curp?:string;phone?:string;email?:string;address?:string;occupation?:string;maritalStatus?:string};problems:string[];allergies:string[];
   vitals:Record<string,string>;labs:{hba1c?:number|undefined;creatinine?:number|undefined;glucose?:number|undefined;ldl?:number|undefined;egfr?:number|undefined;egfrStage?:string|undefined};
   findings:Finding[]};
export async function gatherConsultationSnapshot(ctx:HttpTenantContext,patientId:string):Promise<ConsultationSnapshot>{
 const demo=await patientDemographics(ctx,patientId);
 if(!demo?.birthDate)return{registered:false};
 const age=ageYears(demo.birthDate);const sex=demo.sexAtBirth;
 const[vitals,problems,allergies,hba1c,creat,glucose,ldl,intel]=await Promise.all([
  latestVitalsByType(ctx,patientId),
  activeProblemCodes(ctx,patientId),
  activeAllergySubstances(ctx,patientId),
  // Auditoría C-01/C-02: los "últimos laboratorios" de la cabecera pasan por la misma guarda. Un valor implausible
  // (captura sin unidad en otra escala) u obsoleto NO se pinta como dato vigente del paciente.
  verifiedValues(ctx,patientId,["HBA1C"],MAX_AGE_DAYS.GLYCEMIC_CONTROL),
  verifiedValues(ctx,patientId,["CREATININE"],MAX_AGE_DAYS.RENAL_FUNCTION),
  verifiedValues(ctx,patientId,["GLUCOSE"],MAX_AGE_DAYS.GLYCEMIC_CONTROL),
  // R03-10: el LDL ya tiene unidad canónica, cotas y fuente, así que pasa por la MISMA guarda que el resto (antes era
  // el último consumidor del lector de número desnudo).
  verifiedValues(ctx,patientId,["LDL"],MAX_AGE_DAYS.GLYCEMIC_CONTROL),
  gatherClinicalIntelligence(ctx,patientId),
 ]);
 let egfr:number|undefined,egfrStage:string|undefined;
 const creatV=creat?.["CREATININE"];
 if(age>=18&&(sex==="FEMALE"||sex==="MALE")&&creatV!==undefined){const e=computeEGFR(creatV,age,sex as Sex);if(e){egfr=e.egfr;egfrStage=e.stage;}}
 return{registered:true,demographics:{age,sex:sex??"UNKNOWN",birthDate:demo.birthDate,...(demo.name?{name:demo.name}:{}),...(demo.curp?{curp:demo.curp}:{}),...(demo.phone?{phone:demo.phone}:{}),...(demo.email?{email:demo.email}:{}),...(demo.address?{address:demo.address}:{}),...(demo.occupation?{occupation:demo.occupation}:{}),...(demo.maritalStatus?{maritalStatus:demo.maritalStatus}:{})},problems:[...problems],allergies:[...allergies],
  vitals,labs:{hba1c:hba1c?.["HBA1C"],creatinine:creatV,glucose:glucose?.["GLUCOSE"],ldl:ldl?.["LDL"],egfr,egfrStage},findings:intel.findings};
}
