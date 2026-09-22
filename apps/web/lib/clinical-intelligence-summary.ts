import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{patientDemographics,latestVitalsByType,latestResultValueForAnalyte,activeProblemCodes,activeAllergySubstances,countOpenCriticalResults,countOpenCriticalVitals,administeredVaccines,activeMedicationDrugCodes}from"./clinical-runtime";
import{verifiedValues,MAX_AGE_DAYS,COHERENCE_HOURS}from"./analyte-inputs";
import{stageBloodPressure,parseBp}from"../../../packages/bp-staging/src";
import{interpretINR}from"../../../packages/anticoagulation/src";
import{resolveDrug}from"../../../packages/drug-catalog/src";
import{computeEGFR,type Sex}from"../../../packages/renal-function/src";
import{computeNEWS2}from"../../../packages/lab-reference/src";
import{glycemicAssessment}from"../../../packages/glycemic/src";
import{cha2ds2vasc}from"../../../packages/stroke-risk/src";
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
 const[vitals,codes,openRes,openVit,vaccines,renal,glyc,liver,anticoag,activeDrugs]=await Promise.all([
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
 ]);
 const inp:{-readonly[K in keyof SummaryInputs]:SummaryInputs[K]}={openCriticalResults:openRes,openCriticalVitals:openVit};
 // NEWS2
 const sbp=vitals["BP"]?parseBp(vitals["BP"])?.systolic:undefined; // C-21: parser único
 // Auditoría C-09: NEWS2 solo en adultos; el O₂ suplementario y la conciencia no se registran como signos vitales -> el
 // resultado queda INCOMPLETE salvo que ya sea HIGH/MEDIUM con lo disponible (nunca "bajo" por datos ausentes).
 if(age>=16){const n2=computeNEWS2({resp:num(vitals["RESP"]),spo2:num(vitals["SPO2"]),temp:num(vitals["TEMP"]),hr:num(vitals["HR"]),sbp});
  if(n2.missing.length<7)inp.news2={score:n2.score,band:n2.band,missing:n2.missing};}
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
  latestResultValueForAnalyte(ctx,patientId,"LDL"), // LDL aún sin especificación de unidad/plausibilidad (pendiente C-13)
  gatherClinicalIntelligence(ctx,patientId),
 ]);
 let egfr:number|undefined,egfrStage:string|undefined;
 const creatV=creat?.["CREATININE"];
 if(age>=18&&(sex==="FEMALE"||sex==="MALE")&&creatV!==undefined){const e=computeEGFR(creatV,age,sex as Sex);if(e){egfr=e.egfr;egfrStage=e.stage;}}
 return{registered:true,demographics:{age,sex:sex??"UNKNOWN",birthDate:demo.birthDate,...(demo.name?{name:demo.name}:{}),...(demo.curp?{curp:demo.curp}:{}),...(demo.phone?{phone:demo.phone}:{}),...(demo.email?{email:demo.email}:{}),...(demo.address?{address:demo.address}:{}),...(demo.occupation?{occupation:demo.occupation}:{}),...(demo.maritalStatus?{maritalStatus:demo.maritalStatus}:{})},problems:[...problems],allergies:[...allergies],
  vitals,labs:{hba1c:hba1c?.["HBA1C"],creatinine:creatV,glucose:glucose?.["GLUCOSE"],ldl:num(ldl),egfr,egfrStage},findings:intel.findings};
}
