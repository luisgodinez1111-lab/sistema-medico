// EPIC BU — Evidencia física: interpretación del INR en contexto del anticoagulante activo. Cross-vertical
// resultado(INR)↔medicación(anticoagulante). vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bu-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const act=await import("../../apps/web/app/api/v1/medications/[medicationId]/activation/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const ac=await import("../../apps/web/app/api/v1/patients/[patientId]/anticoagulation-status/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["medication:propose","medication:write","result:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000/* reloj RELATIVO: las calculadoras rechazan datos obsoletos; una fecha fija haría caducar la prueba */;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
// Contrato de la remediación (auditoría C-03/C-05, lote 1): con barreras NO verificables (paciente sintético sin edad, peso o
// eGFR) PRESCRIBE responde 428 hasta que el médico confirma y justifica. Las barreras BLOQUEADAS siguen devolviendo 403.
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const B=(t:string,v:number)=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:at(),...ACK})});
async function activateWarfarin(t:string,pat:string){const id=crypto.randomUUID();await meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:pat,drugCode:"warfarina-5",dose:"5mg",route:"VO",frequency:"c/24h",occurredAt:at()})}));await rx.POST(new Request("http://l/",B(t,1)),MP(id));await act.POST(new Request("http://l/",B(t,2)),MP(id));}
async function inr(t:string,pat:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:pat,orderId:crypto.randomUUID(),analyte:"INR",value:v,occurredAt:at()})}));}
async function get(t:string,pat:string){const r=await ac.GET(new Request("http://l/",{headers:H(t)}),PP(pat));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) warfarina activa + INR 2.5 -> THERAPEUTIC, onAnticoagulant true
 const p1=crypto.randomUUID();await activateWarfarin(phys,p1);await inr(phys,p1,"2.5");
 let g=await get(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.status==="THERAPEUTIC"&&g.body.onAnticoagulant===true,"THERAPEUTIC_ON_ANTICOAG");
 // 2) usa el INR MÁS RECIENTE: 1.4 -> SUBTHERAPEUTIC
 await inr(phys,p1,"1.4");g=await get(phys,p1);ok(g.body.status==="SUBTHERAPEUTIC","SUBTHERAPEUTIC");
 // 3) INR 6.0 -> CRITICAL_HIGH
 await inr(phys,p1,"6.0");g=await get(phys,p1);ok(g.body.status==="CRITICAL_HIGH","CRITICAL_HIGH");
 // 4) paciente SIN anticoagulante + INR 2.5 -> interpretado pero onAnticoagulant false + nota
 const p2=crypto.randomUUID();await inr(phys,p2,"2.5");
 g=await get(phys,p2);ok(g.body.computable===true&&g.body.onAnticoagulant===false&&/vitamina K/i.test(g.body.note),"NO_ANTICOAG_NOTE");
 // 5) sin INR -> no computable
 const p3=crypto.randomUUID();g=await get(phys,p3);ok(g.body.computable===false,"NO_INR_NOT_COMPUTABLE");
 // 6) sin scope patient:read -> 403
 const noScope=tok(["result:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
