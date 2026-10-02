// Hallazgo D2 del lote 11 — Evidencia física: la demografía que leen la lista, la demografía clínica, la TFG, los registros
// y la detección de duplicados es la VIGENTE (campo a campo, como `foldPatient`), no el alta combinada con la ÚLTIMA enmienda.
// Antes, tras corregir nombre y fecha de nacimiento y después solo el teléfono, todo volvía a los datos del alta (un niño
// volvía a ser adulto para la TFG y perdía a su tutor), y una CURP corregida por enmienda no se detectaba como duplicada. vs Neon.
// Porte a main (grupo D1-D2-SQL1): mismos checks; imports a la fachada `clinical-runtime` de main y un check más sobre
// `topPatientsOfRegistry`, que solo existe en main.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET; // R11-07: el secreto lo pone el prólogo/entorno, nunca la prueba
const{signSession}=await import("../../packages/session/src");
const{foldPatient}=await import("../../packages/patient-fold/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const amendR=await import("../../apps/web/app/api/v1/patients/[patientId]/amendment/route");
const snapR=await import("../../apps/web/app/api/v1/patients/[patientId]/consultation-snapshot/route");
const egfrR=await import("../../apps/web/app/api/v1/patients/[patientId]/egfr/route");
const algR=await import("../../apps/web/app/api/v1/allergies/route");
const{readAggregateEvents,patientDemographics,topPatientsOfRegistry}=await import("../../apps/web/lib/clinical-runtime");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);const SUB=crypto.randomUUID();
const tok=()=>signSession({sub:SUB,tenantId:TA,roles:["PHYSICIAN"],scopes:["patient:write","patient:read","allergy:write","allergy:read"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});const at=new Date().toISOString();const idem=()=>crypto.randomUUID();
const ctx={tenantId:TA,actorId:SUB,actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:crypto.randomUUID()};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function register(t:string,body:Record<string,unknown>){const r=await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({...body,occurredAt:at})}));return{status:r.status,body:await r.json()};}
async function amend(t:string,p:string,ifm:string,body:Record<string,unknown>){const r=await amendR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":ifm}),body:JSON.stringify({...body,occurredAt:at})}),PP(p));return{status:r.status,body:await r.json()};}
async function listed(t:string,p:string,q=""){const r=await patR.GET(new Request("http://l/"+q,{headers:H(t)}));return((await r.json()).patients as{patientId:string;name:string;birthDate?:string}[]).find(x=>x.patientId===p);}
try{
 const phys=tok();
 // A) Alta como adulta; enmienda 1: nombre, fecha de nacimiento (niña) y tutor; enmienda 2: SOLO el teléfono.
 const p=crypto.randomUUID();
 ok((await register(phys,{patientId:p,name:"Registro Original",birthDate:"1980-01-01",sexAtBirth:"FEMALE",phone:"5550000001"})).status===201,"REGISTERED_201");
 ok((await amend(phys,p,"1",{name:"Nombre Enmendado",birthDate:"2020-05-05",guardian:{name:"Tutor Legal",relationship:"Madre"}})).status===201,"AMEND_NAME_BIRTHDATE_GUARDIAN_201");
 ok((await amend(phys,p,"2",{phone:"5559999999"})).status===201,"AMEND_PHONE_ONLY_201");
 const f=foldPatient(await readAggregateEvents(ctx,p));const d=await patientDemographics(ctx,p);
 ok(d?.name==="Nombre Enmendado"&&d.birthDate==="2020-05-05"&&d.guardian?.name==="Tutor Legal"&&d.phone==="5559999999"&&d.sexAtBirth==="FEMALE","DEMOGRAPHICS_KEEP_EVERY_AMENDMENT");
 ok(d?.name===f.name&&d?.birthDate===f.birthDate&&d?.sexAtBirth===f.sexAtBirth,"DEMOGRAPHICS_MATCH_FOLD");
 const row=await listed(phys,p);ok(row?.name==="Nombre Enmendado"&&row.birthDate==="2020-05-05","LIST_KEEPS_AMENDED_NAME_AND_BIRTHDATE");
 ok((await listed(phys,p,"?q=nombre enm"))?.patientId===p&&(await listed(phys,p,"?q=registro orig"))===undefined,"LIST_SEARCH_USES_CURRENT_NAME");
 const s=await snapR.GET(new Request("http://l/",{headers:H(phys)}),PP(p));const sd=(await s.json()).demographics;
 ok(s.status===200&&sd?.name==="Nombre Enmendado"&&sd?.birthDate==="2020-05-05"&&sd?.age<18&&sd?.phone==="5559999999","SNAPSHOT_KEEPS_AMENDMENTS");
 const e=await egfrR.GET(new Request("http://l/",{headers:H(phys)}),PP(p));const eb=await e.json();
 ok(e.status===200&&typeof eb.ageYears==="number"&&eb.ageYears<18,"EGFR_USES_AMENDED_AGE");
 const allergyId=crypto.randomUUID();
 const ar=await algR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({allergyId,patientId:p,substance:"Penicilina",severity:"SEVERE",reaction:"Anafilaxia",occurredAt:at})}));
 const reg=await(await algR.GET(new Request("http://l/",{headers:H(phys)}))).json();
 ok(ar.status===201&&(reg.items as{allergyId:string;patientName:string}[]).find(x=>x.allergyId===allergyId)?.patientName==="Nombre Enmendado","REGISTRY_SHOWS_CURRENT_NAME");
 // Porte a main: el resumen «pacientes con más registros» (topPatientsOfRegistry, solo existe en main) usa el mismo nombre.
 ok((await topPatientsOfRegistry(ctx,{aggregateType:"Allergy",baseKind:"RECORDED"})).find(x=>x.patientId===p)?.name==="Nombre Enmendado","REGISTRY_TOP_PATIENTS_SHOWS_CURRENT_NAME");
 // B) Duplicados contra la demografía VIGENTE: la CURP corregida por enmienda identifica a su paciente.
 const q=crypto.randomUUID();
 ok((await register(phys,{patientId:q,name:"Ana Lopez Garcia",birthDate:"1990-01-01",sexAtBirth:"FEMALE"})).status===201,"SECOND_PATIENT_REGISTERED");
 ok((await amend(phys,q,"1",{curp:"LOGA900101MDFPRN07"})).status===201,"CURP_SET_BY_AMENDMENT");
 const dup=await register(phys,{patientId:crypto.randomUUID(),name:"Otra Persona",birthDate:"1990-01-01",sexAtBirth:"FEMALE",curp:"LOGA900101MDFPRN07"});
 ok(dup.status===409&&dup.body.error?.details?.duplicateBy==="CURP"&&dup.body.error?.details?.duplicateOf===q,"DUPLICATE_BY_AMENDED_CURP_409");
 const byName=await register(phys,{patientId:crypto.randomUUID(),name:"Nombre Enmendado",birthDate:"2020-05-05",sexAtBirth:"FEMALE"});
 ok(byName.status===409&&byName.body.error?.details?.duplicateBy==="NAME_BIRTHDATE"&&byName.body.error?.details?.duplicateOf===p,"DUPLICATE_BY_AMENDED_NAME_BIRTHDATE_409");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
