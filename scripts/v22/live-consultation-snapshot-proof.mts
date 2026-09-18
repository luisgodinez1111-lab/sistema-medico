// EPIC CF — Evidencia física: snapshot de consulta (panel 1) determinista — demografía + valores clínicos
// actuales + problemas/alergias + findings CDS, desde datos sembrados. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-cf-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const prob=await import("../../apps/web/app/api/v1/problems/route");
const alR=await import("../../apps/web/app/api/v1/allergies/route");
const snapR=await import("../../apps/web/app/api/v1/patients/[patientId]/consultation-snapshot/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write","problem:write","allergy:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number,sex:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:"Prueba",birthDate:birth(y),sexAtBirth:sex,occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,occurredAt:at()})}));}
async function dx(t:string,p:string,c:string){await prob.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code:c,occurredAt:at()})}));}
async function allergy(t:string,p:string,s:string){await alR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:crypto.randomUUID(),patientId:p,substance:s,severity:"MODERATE",reaction:"rash",occurredAt:at()})}));}
async function get(t:string,p:string){const r=await snapR.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 const p=crypto.randomUUID();await reg(phys,p,54,"FEMALE");
 for(const c of["E11.9","I10","N18.3"])await dx(phys,p,c);
 await res(phys,p,"CREATININE","1.3");
 await res(phys,p,"HBA1C","7.1");
 await allergy(phys,p,"penicilina");
 const g=await get(phys,p);
 ok(g.status===200,"SNAPSHOT_200");
 ok(g.body.registered===true,"REGISTERED");
 ok(g.body.demographics.age>=53&&g.body.demographics.age<=54,"AGE_54");
 ok(g.body.demographics.sex==="FEMALE","SEX_FEMALE");
 ok(Array.isArray(g.body.problems)&&g.body.problems.length===3,"PROBLEMS_3");
 ok(g.body.labs.hba1c===7.1,"HBA1C_VALUE");
 ok(typeof g.body.labs.egfr==="number"&&!!g.body.labs.egfrStage,"EGFR_STAGED");
 ok(Array.isArray(g.body.findings),"FINDINGS_ARRAY");
 ok(Array.isArray(g.body.allergies)&&g.body.allergies.includes("penicilina"),"ALLERGY_PRESENT");
 // no registrado -> 404
 const g2=await get(phys,crypto.randomUUID());ok(g2.status===404,"UNREGISTERED_404");
 // sin scope -> 403
 const noScope=tok(["result:write"]);const g3=await get(noScope,p);ok(g3.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
