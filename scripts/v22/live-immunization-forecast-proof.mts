// EPIC BK — Evidencia física: pronóstico de vacunación por edad desde el nacimiento + vacunas aplicadas. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const pat=await import("../../apps/web/app/api/v1/patients/route");
const imm=await import("../../apps/web/app/api/v1/immunizations/route");
const adm=await import("../../apps/web/app/api/v1/immunizations/[immunizationId]/administration/route");
const fc=await import("../../apps/web/app/api/v1/patients/[patientId]/immunization-forecast/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","immunization:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});const IP=(id:string)=>({params:Promise.resolve({immunizationId:id})});
const ISO="2026-09-14T09:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
// bebé de ~24 meses respecto a "hoy" (fecha del servidor).
const d=new Date();d.setUTCMonth(d.getUTCMonth()-24);const BIRTH=d.toISOString().slice(0,10);
async function administer(t:string,pat_:string,code:string){const id=crypto.randomUUID();await imm.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({immunizationId:id,patientId:pat_,vaccineCode:code,dose:"1",occurredAt:ISO})}));await adm.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({lot:"L1",site:"deltoides",occurredAt:ISO})}),IP(id));}
async function getFc(t:string,p:string){const r=await fc.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // paciente de 24 meses con BCG aplicada, sin el resto
 const p=crypto.randomUUID();
 let r=await pat.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:"Bebé Prueba",birthDate:BIRTH,sexAtBirth:"FEMALE",occurredAt:ISO})}));
 ok(r.status===201||r.status===200,"PATIENT_REGISTERED");
 await administer(phys,p,"BCG");
 const g=await getFc(phys,p);ok(g.status===200,"FORECAST_200");
 const F=g.body.forecast as{code:string;doseNumber:number;status:string}[];
 ok(Array.isArray(F)&&F.length>0,"FORECAST_NONEMPTY");
 ok(g.body.ageMonths>=23&&g.body.ageMonths<=25,"AGE_APPROX_24M");
 ok(F.find(x=>x.code==="BCG")?.status==="COMPLETE","BCG_COMPLETE");
 // SRP a los 12m no aplicada en un bebé de 24m -> OVERDUE
 ok(F.find(x=>x.code==="SRP"&&x.doseNumber===1)?.status==="OVERDUE","SRP_12M_OVERDUE");
 // PENTA refuerzo a los 18m no aplicada -> OVERDUE; DPT a los 48m -> UPCOMING
 ok(F.find(x=>x.code==="PENTA"&&x.doseNumber===4)?.status==="OVERDUE","PENTA_18M_OVERDUE");
 ok(F.find(x=>x.code==="DPT"&&x.doseNumber===1)?.status==="UPCOMING","DPT_48M_UPCOMING");
 ok(typeof g.body.summary.overdue==="number"&&g.body.summary.overdue>0,"SUMMARY_OVERDUE_COUNT");
 // paciente no registrado -> 404
 const g2=await getFc(phys,crypto.randomUUID());ok(g2.status===404,"UNREGISTERED_404");
 // sin scope patient:read -> 403
 const noScope=tok(["immunization:write"]);const g3=await getFc(noScope,p);ok(g3.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
