// Auditoría 2026-09-19, anexo R03 (R03-29, R03-26) — Evidencia física: el EMBARAZO y la LACTANCIA del expediente
// bloquean la prescripción, y la DURACIÓN es una barrera propia. Antes, las reglas del embarazo existían en el catálogo
// y la barrera nunca recibía el factor: eran código inalcanzable. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts");
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: PRESCRIBE exige cédula
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const prob=await import("../../apps/web/app/api/v1/problems/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const presc=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const check=await import("../../apps/web/app/api/v1/patients/[patientId]/prescription-check/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const phys=signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes:["medication:propose","medication:write","medication:prescribe","patient:read","patient:write","problem:write","vital:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
const H=(x:Record<string,string>={})=>({"content-type":"application/json",authorization:"Bearer "+phys,...x});
const idem=()=>crypto.randomUUID();const PP=(id:string)=>({params:Promise.resolve({patientId:id})});const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});
let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60000).toISOString();
const{result,ok,fin}=libro();
async function dx(p:string,code:string){const r=await prob.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code,occurredAt:at()})}));if(r.status>=400)throw new Error("DX_FAILED:"+r.status+":"+await r.text());}
async function propose(p:string,drugCode:string,dose:string,frequency:string,duration?:string){
 const id=crypto.randomUUID();
 const r=await meds.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:p,drugCode,dose,route:"ORAL",frequency,...(duration?{duration}:{}),occurredAt:at()})}));
 if(r.status>=400)throw new Error("PROPOSE_FAILED:"+r.status+":"+await r.text());
 return id;
}
async function prescribe(medicationId:string,body:Record<string,unknown>={}){
 return presc.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({...body,occurredAt:at()})}),MP(medicationId));
}
async function dryRun(p:string,drug:string,dose:string,frequency:string,duration?:string){
 const r=await check.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({drug,dose,route:"ORAL",frequency,...(duration?{duration}:{})})}),PP(p));
 return{status:r.status,body:await r.json() as Record<string,unknown>};
}
type Err={error:{code:string;message:string;details?:{overridable?:string[];hard?:string[]}}};
try{
 await registerPhysicianCredentials(phys);
 // 1) R03-29: gestante (Z34.9 en la lista de problemas ACTIVOS) + enalapril -> BLOQUEO por fetotoxicidad.
 //    Nadie declara «embarazada»: el factor sale del expediente.
 const gest=crypto.randomUUID();await ensurePatientIn(TA,gest,{sexAtBirth:"FEMALE",birthDate:"1996-04-10"});
 await dx(gest,"Z34.9");
 let d=await dryRun(gest,"enalapril-10","10mg","QD");
 ok(d.status===200&&d.body["verdict"]==="BLOCK","PREGNANCY_DRY_RUN_BLOCK");
 ok(JSON.stringify(d.body).includes("Embarazo"),"PREGNANCY_FACTOR_NAMED");
 const m1=await propose(gest,"enalapril-10","10mg","QD");
 let r=await prescribe(m1);let e=await r.json() as Err;
 ok(r.status===403&&e.error.code==="SAFETY_BLOCKED","PREGNANCY_PRESCRIBE_BLOCKED_403");
 ok((e.error.details?.overridable??[]).includes("interaction"),"PREGNANCY_BLOCK_IS_OVERRIDABLE");
 // 2) ...y se puede anular con justificación (es una decisión clínica documentada, no un error de captura)
 // (La paciente no tiene creatinina, así que la barrera renal queda NO evaluada: prescribir exige además la confirmación
 // expresa de lo no verificado. Son dos cosas distintas y el sistema pide las dos.)
 r=await prescribe(m1,{overrideBarriers:["interaction"],overrideJustification:"Hipertensión grave sin alternativa disponible; se suspende el IECA hoy y se cambia a alfametildopa en la misma consulta",
  acknowledgeUnverified:true,unverifiedJustification:"Sin creatinina vigente; se solicita en esta consulta y se reevalúa la dosis al recibirla"});
 ok(r.status===201,"PREGNANCY_OVERRIDE_WITH_JUSTIFICATION_201");
 // 3) La misma prescripción en una paciente NO gestante pasa sin bloqueo: el bloqueo viene del expediente.
 const noGest=crypto.randomUUID();await ensurePatientIn(TA,noGest,{sexAtBirth:"FEMALE",birthDate:"1996-04-10"});
 d=await dryRun(noGest,"enalapril-10","10mg","QD");
 ok(d.status===200&&d.body["verdict"]!=="BLOCK","NO_PREGNANCY_NO_BLOCK");
 // 4) R03-29: lactancia (Z39.1) + tramadol -> BLOQUEO (FDA 2017: muertes neonatales descritas)
 const lact=crypto.randomUUID();await ensurePatientIn(TA,lact,{sexAtBirth:"FEMALE",birthDate:"1994-02-02"});
 await dx(lact,"Z39.1");
 d=await dryRun(lact,"tramadol-50","50mg","c/8h");
 ok(d.body["verdict"]==="BLOCK"&&JSON.stringify(d.body).includes("Lactancia"),"LACTATION_BLOCKS_TRAMADOL");
 // 5) R03-26: la DURACIÓN es una barrera propia. Ketorolaco 7 días se bloquea; 3 días pasa.
 const ad=crypto.randomUUID();await ensurePatientIn(TA,ad,{birthDate:"1985-01-01"});
 d=await dryRun(ad,"ketorolaco-10","10mg","c/8h","7 días");
 ok(d.body["verdict"]==="BLOCK"&&JSON.stringify(d.body).includes("máximo de 5"),"DURATION_EXCEEDED_BLOCKS");
 d=await dryRun(ad,"ketorolaco-10","10mg","c/8h","3 días");
 // La ruta traduce el estado de la barrera al vocabulario de la interfaz (PASSED -> "OK").
 const barreras=d.body["checks"] as {id:string;status:string}[];
 ok(barreras.some(b=>b.id==="duration"&&b.status==="OK"),"DURATION_WITHIN_LIMIT_PASSES");
 // ...y en la ESCRITURA: la propuesta con 7 días se rechaza antes de prescribir
 let bloqueada=false;
 try{await propose(ad,"ketorolaco-10","10mg","c/8h","7 días");}catch(err){bloqueada=/SAFETY_BLOCKED/.test(String(err));}
 ok(bloqueada,"DURATION_BLOCKS_AT_PROPOSAL");
 // 6) R03-26: el techo por VÍA. 30 mg c/6h de ketorolaco = 120 mg/día: correcto IV, triple del máximo ORAL.
 d=await dryRun(ad,"ketorolaco-30","30mg","c/6h","3 días");
 ok(d.body["verdict"]==="BLOCK"&&JSON.stringify(d.body).includes("40 mg/día"),"ORAL_ROUTE_CEILING_BLOCKS");
 // 7) R03-26: el techo por EDAD (citalopram 20 mg/día a partir de los 60 años, FDA 2012)
 const mayor=crypto.randomUUID();await ensurePatientIn(TA,mayor,{birthDate:"1950-06-15"});
 d=await dryRun(mayor,"citalopram-20","30mg","QD");
 ok(d.body["verdict"]==="BLOCK"&&JSON.stringify(d.body).includes("QT"),"AGE_CEILING_BLOCKS");
 d=await dryRun(ad,"citalopram-20","30mg","QD");
 ok(d.body["verdict"]!=="BLOCK","AGE_CEILING_ONLY_FOR_ELDERLY");
 // 8) La cobertura del catálogo viaja con el veredicto (R03-23)
 const cov=d.body["catalog"] as {ingredients:number;sourceNote:string};
 ok(cov.ingredients>=60&&/NO es un vademécum oficial/.test(cov.sourceNote),"CATALOG_COVERAGE_IN_RESPONSE");
}catch(err){fin(err);}
fin();
