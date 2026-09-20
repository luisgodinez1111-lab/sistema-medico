// EPIC Y/UI — Evidencia física: contexto para Nueva interconsulta (panel "Información relevante del paciente")
// + envío de la interconsulta. Compone alergias + medicamentos activos (nombre) + problemas activos + HbA1c +
// signos vitales, y verifica POST /referrals. Determinista, RLS-scoped. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-y-ctx-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const prR=await import("../../apps/web/app/api/v1/problems/route");
const alR=await import("../../apps/web/app/api/v1/allergies/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const vitR=await import("../../apps/web/app/api/v1/vitals/route");
const medR=await import("../../apps/web/app/api/v1/medications/route");
const medRxR=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const medActR=await import("../../apps/web/app/api/v1/medications/[medicationId]/activation/route");
const refR=await import("../../apps/web/app/api/v1/referrals/route");
const ctxR=await import("../../apps/web/app/api/v1/patients/[patientId]/referral-context/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","problem:write","allergy:write","result:write","vital:write","medication:propose","medication:write","referral:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:"Ana López García",birthDate:birth(34),sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function prob(t:string,p:string,code:string){await prR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code,occurredAt:at()})}));}
async function allergy(t:string,p:string,s:string){await alR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:crypto.randomUUID(),patientId:p,substance:s,severity:"MODERATE",reaction:"rash",occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,occurredAt:at()})}));}
async function vital(t:string,p:string,vt:string,v:string,u:string,a:string){await vitR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType:vt,value:v,unit:u,occurredAt:a})}));}
async function medActive(t:string,p:string,drugCode:string){const id=crypto.randomUUID();
 await medR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:p,drugCode,dose:"1 tab",route:"Oral",frequency:"c/12h",occurredAt:at()})}));
 await medRxR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at(),...ACK})}),{params:Promise.resolve({medicationId:id})});
 await medActR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({medicationId:id})});
}
async function referral(t:string,p:string,specialty:string,reason:string){const r=await refR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({referralId:crypto.randomUUID(),patientId:p,specialty,reason,occurredAt:at()})}));return r.status;}
async function context(t:string,p:string){const r=await ctxR.GET(new Request("http://l/",{method:"GET",headers:H(t)}),{params:Promise.resolve({patientId:p})});return{status:r.status,body:await r.json()};}
// Contrato de la remediación (auditoría C-03/C-05, lote 1): con barreras NO verificables (paciente sintético sin edad, peso o
// eGFR) PRESCRIBE responde 428 hasta que el médico confirma y justifica. Las barreras BLOQUEADAS siguen devolviendo 403.
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();const p=crypto.randomUUID();await reg(phys,p);
 await prob(phys,p,"E11.9");await prob(phys,p,"I10");await prob(phys,p,"E66.9");
 await allergy(phys,p,"Amoxicilina");
 await medActive(phys,p,"metformina");await medActive(phys,p,"losartan");
 await res(phys,p,"HBA1C","8.1");
 const va=at();await vital(phys,p,"BP","124/82","mmHg",va);await vital(phys,p,"HR","76","lpm",va);await vital(phys,p,"WEIGHT","78","kg",va);await vital(phys,p,"HEIGHT","161","cm",va);

 const C=await context(phys,p);ok(C.status===200,"CTX_200");
 const b=C.body as{allergies:string[];medications:string[];problems:{code:string;description:string}[];labs:{hba1c:string|null};vitals:{bp:string|null;hr:string|null;imc:string|null}};
 ok(b.allergies.includes("Amoxicilina"),"ALLERGY_LISTED");
 ok(b.medications.includes("metformina")&&b.medications.includes("losartan"),"MEDS_NAMED");
 ok(b.problems.length===3,"THREE_PROBLEMS");
 ok(b.problems.find(x=>x.code==="E11.9")?.description?.toLowerCase().includes("diabetes")??false,"PROBLEM_DESCRIPTION");
 ok(b.labs.hba1c==="8.1","HBA1C_REAL");
 ok(b.vitals.bp==="124/82"&&b.vitals.hr==="76","VITALS_REAL");
 ok(b.vitals.imc==="30.1","IMC_DERIVED");

 // enviar interconsulta
 ok(await referral(phys,p,"Endocrinología","Valoración y manejo integral de DM2")===201,"REFERRAL_SENT_201");

 // sin scope -> 403
 const noScope=await context(tok(["patient:read"]),p);
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
