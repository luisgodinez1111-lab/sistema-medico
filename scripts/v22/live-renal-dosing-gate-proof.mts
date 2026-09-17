// EPIC BM — Evidencia física: el gate renal por eGFR MEDIDO bloquea fármacos contraindicados por función
// renal en la prescripción (metformina/AINE con TFG<30). Cross-vertical medicación←creatinina+demografía. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bm-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","result:write","medication:propose","medication:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});const ISO="2026-09-14T09:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function register(t:string,p:string,y:number){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:"Prueba",birthDate:birth(y),sexAtBirth:"MALE",occurredAt:ISO})}));}
async function creat(t:string,p:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:"CREATININE",value:v,occurredAt:ISO})}));}
const order={dose:"850mg",route:"VO",frequency:"c/12h"};
async function propose(t:string,p:string,drugCode:string,o=order){const id=crypto.randomUUID();await meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:p,drugCode,...o,occurredAt:ISO})}));return id;}
const B=(t:string)=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})});
try{
 const phys=tok();
 // 1) hombre 70a con creatinina 4.0 -> TFG ~15 (<30): metformina BLOQUEADA 403
 const p1=crypto.randomUUID();await register(phys,p1,70);await creat(phys,p1,"4.0");
 const mf=await propose(phys,p1,"metformina-850");
 let r=await rx.POST(new Request("http://l/",B(phys)),MP(mf));ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","METFORMIN_LOW_EGFR_BLOCKED_403");
 // 2) mismo paciente: AINE (ibuprofeno) también contraindicado con TFG<30 -> BLOQUEADO
 const ib=await propose(phys,p1,"ibuprofeno-400",{dose:"400mg",route:"VO",frequency:"c/8h"});
 r=await rx.POST(new Request("http://l/",B(phys)),MP(ib));ok(r.status===403,"NSAID_LOW_EGFR_BLOCKED_403");
 // 3) hombre 40a con creatinina 0.9 -> TFG normal: metformina PERMITIDA 201
 const p2=crypto.randomUUID();await register(phys,p2,40);await creat(phys,p2,"0.9");
 const mf2=await propose(phys,p2,"metformina-850");
 r=await rx.POST(new Request("http://l/",B(phys)),MP(mf2));ok(r.status===201,"METFORMIN_NORMAL_EGFR_ALLOWED_201");
 // 4) sin eGFR computable (sin creatinina) -> el gate renal no bloquea (fail-open): metformina PERMITIDA
 const p3=crypto.randomUUID();await register(phys,p3,40);
 const mf3=await propose(phys,p3,"metformina-850");
 r=await rx.POST(new Request("http://l/",B(phys)),MP(mf3));ok(r.status===201,"NO_EGFR_NOT_BLOCKED_201");
 // 5) amoxicilina (sin regla renal) con TFG baja -> PERMITIDA
 const am=await propose(phys,p1,"amoxicilina-500",{dose:"500mg",route:"VO",frequency:"c/8h"});
 r=await rx.POST(new Request("http://l/",B(phys)),MP(am));ok(r.status===201,"NONRENAL_DRUG_ALLOWED_201");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
