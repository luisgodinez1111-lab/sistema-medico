import{type HttpTenantContext}from"../../../packages/http-principal/src";
import{patientDemographics,latestVitalsByType,latestResultValueForAnalyte,activeProblemCodes,activeAllergySubstances,countOpenCriticalResults,countOpenCriticalVitals,administeredVaccineCodes,activeMedicationDrugCodes}from"./clinical-runtime";
import{stageBloodPressure,parseBp}from"../../../packages/bp-staging/src";
import{interpretINR}from"../../../packages/anticoagulation/src";
import{resolveDrug}from"../../../packages/drug-catalog/src";
import{computeEGFR,type Sex}from"../../../packages/renal-function/src";
import{computeNEWS2}from"../../../packages/lab-reference/src";
import{glycemicAssessment}from"../../../packages/glycemic/src";
import{cha2ds2vasc}from"../../../packages/stroke-risk/src";
import{fib4}from"../../../packages/liver-fibrosis/src";
import{computeBMI,heightToMeters}from"../../../packages/anthropometrics/src";
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
 const[vitals,codes,openRes,openVit,vaccines,creat,a1c,ast,alt,plt,inrRaw,activeDrugs]=await Promise.all([
  latestVitalsByType(ctx,patientId),
  activeProblemCodes(ctx,patientId),
  countOpenCriticalResults(ctx,patientId),
  countOpenCriticalVitals(ctx,patientId),
  administeredVaccineCodes(ctx,patientId),
  latestResultValueForAnalyte(ctx,patientId,"CREATININE"),
  latestResultValueForAnalyte(ctx,patientId,"HBA1C"),
  latestResultValueForAnalyte(ctx,patientId,"AST"),
  latestResultValueForAnalyte(ctx,patientId,"ALT"),
  latestResultValueForAnalyte(ctx,patientId,"PLATELETS"),
  latestResultValueForAnalyte(ctx,patientId,"INR"),
  activeMedicationDrugCodes(ctx,patientId),
 ]);
 const inp:{-readonly[K in keyof SummaryInputs]:SummaryInputs[K]}={openCriticalResults:openRes,openCriticalVitals:openVit};
 // NEWS2
 let sbp:number|undefined;const bp=vitals["BP"];if(bp){const m=/^(\d{2,3})/.exec(bp.trim());if(m)sbp=Number(m[1]);}
 const n2=computeNEWS2({resp:num(vitals["RESP"]),spo2:num(vitals["SPO2"]),temp:num(vitals["TEMP"]),hr:num(vitals["HR"]),sbp});
 if(n2.missing.length<6)inp.news2={score:n2.score,band:n2.band};
 // eGFR
 if(age>=18&&(sex==="FEMALE"||sex==="MALE")&&creat!==undefined){const e=computeEGFR(Number(creat),age,sex as Sex);if(e)inp.egfr={egfr:e.egfr,stage:e.stage};}
 // Glucémico
 if(a1c!==undefined&&Number.isFinite(Number(a1c))){const g=glycemicAssessment(Number(a1c),has(codes,"E10","E11"));if(g)inp.glycemic={category:g.category,label:g.label};}
 // CHA2DS2-VASc
 const cv=cha2ds2vasc({ageYears:age,female:sex==="FEMALE",chf:has(codes,"I50"),hypertension:has(codes,"I10"),diabetes:has(codes,"E10","E11"),strokeHistory:has(codes,"I63","G45","I64"),vascularDisease:has(codes,"I25","I21","I73")});
 if(cv)inp.cha2ds2vasc={score:cv.score,risk:cv.risk,applicable:has(codes,"I48")};
 // FIB-4
 if([ast,alt,plt].every(x=>x!==undefined)){const fr=fib4(age,Number(ast),Number(alt),Number(plt));if(fr)inp.fib4={value:fr.value,risk:fr.risk};}
 // IMC
 const w=num(vitals["WEIGHT"]);const h=heightToMeters(num(vitals["HEIGHT"])??NaN);
 if(w!==undefined&&h!==undefined){const b=computeBMI(w,h);if(b)inp.bmi={category:b.category};}
 // Vacunas vencidas (solo pediatría tiene esquema aquí)
 if(age<6){const fc=forecastImmunizations(demo.birthDate,vaccines,asOf);inp.overdueVaccines=forecastSummary(fc).overdue;}
 // Presión arterial (estadificación ACC/AHA)
 const bpv=vitals["BP"];if(bpv){const pb=parseBp(bpv);if(pb){const bs=stageBloodPressure(pb.systolic,pb.diastolic);if(bs)inp.bp={stage:bs.stage};}}
 // INR (contexto del anticoagulante activo)
 if(inrRaw!==undefined&&Number.isFinite(Number(inrRaw))){const ir=interpretINR(Number(inrRaw));if(ir)inp.inr={status:ir.status,onAnticoagulant:activeDrugs.some(dc=>resolveDrug(dc)?.classes.includes("ANTICOAGULANT"))};}
 const findings=assembleFindings(inp);
 return{registered:true,findings,summary:summarize(findings)};
}

// EPIC CF — Snapshot de consulta (panel "Vista principal – Durante la consulta"). Reúne demografía +
// valores clínicos actuales + problemas/alergias + los findings deterministas del motor CDS. Núcleo
// determinista (R6 en pausa: sin IA generativa). PHI cruda -> endpoint autorizado (patient:read/TREATMENT).
export type ConsultationSnapshot=
 |{registered:false}
 |{registered:true;demographics:{age:number;sex:string;birthDate:string};problems:string[];allergies:string[];
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
  latestResultValueForAnalyte(ctx,patientId,"HBA1C"),
  latestResultValueForAnalyte(ctx,patientId,"CREATININE"),
  latestResultValueForAnalyte(ctx,patientId,"GLUCOSE"),
  latestResultValueForAnalyte(ctx,patientId,"LDL"),
  gatherClinicalIntelligence(ctx,patientId),
 ]);
 let egfr:number|undefined,egfrStage:string|undefined;
 if(age>=18&&(sex==="FEMALE"||sex==="MALE")&&creat!==undefined){const e=computeEGFR(Number(creat),age,sex as Sex);if(e){egfr=e.egfr;egfrStage=e.stage;}}
 return{registered:true,demographics:{age,sex:sex??"UNKNOWN",birthDate:demo.birthDate},problems:[...problems],allergies:[...allergies],
  vitals,labs:{hba1c:num(hba1c),creatinine:num(creat),glucose:num(glucose),ldl:num(ldl),egfr,egfrStage},findings:intel.findings};
}
