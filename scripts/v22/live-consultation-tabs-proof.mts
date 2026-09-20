// EPIC K/UI — Evidencia física: pestañas por paciente de la vista Consulta. Siembra resultados, órdenes,
// medicamentos activos, metas de plan, documentos y obligaciones de un paciente, y verifica GET
// /patients/:id/consultation-tabs -> cada pestaña con sus datos reales del paciente. RLS-scoped. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-k-tabs-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const ordR=await import("../../apps/web/app/api/v1/orders/route");
const medR=await import("../../apps/web/app/api/v1/medications/route");
const medRxR=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const medActR=await import("../../apps/web/app/api/v1/medications/[medicationId]/activation/route");
const cpR=await import("../../apps/web/app/api/v1/care-plans/route");
const docR=await import("../../apps/web/app/api/v1/documents/route");
const obR=await import("../../apps/web/app/api/v1/obligations/route");
const tabsR=await import("../../apps/web/app/api/v1/patients/[patientId]/consultation-tabs/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write","order:write","medication:propose","medication:write","careplan:write","document:write","obligation:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:"Ana López García",birthDate:birth(34),sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,occurredAt:at()})}));}
async function order(t:string,p:string,ot:string,detail:string){await ordR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({orderId:crypto.randomUUID(),patientId:p,orderType:ot,detail,occurredAt:at()})}));}
async function medActive(t:string,p:string,drugCode:string){const id=crypto.randomUUID();await medR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:p,drugCode,dose:"1 tab",route:"Oral",frequency:"c/12h",occurredAt:at()})}));await medRxR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at(),...ACK})}),{params:Promise.resolve({medicationId:id})});await medActR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({medicationId:id})});}
async function goal(t:string,p:string,cat:string,g:string){await cpR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({carePlanId:crypto.randomUUID(),patientId:p,category:cat,goal:g,occurredAt:at()})}));}
async function doc(t:string,p:string,dt:string,title:string){await docR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({documentId:crypto.randomUUID(),patientId:p,docType:dt,title,content:"x",occurredAt:at()})}));}
async function obl(t:string,p:string,kind:string){await obR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:crypto.randomUUID(),patientId:p,ownerId:crypto.randomUUID(),dueAt:at(),kind,occurredAt:at()})}));}
async function tabs(t:string,p:string){const r=await tabsR.GET(new Request("http://l/",{method:"GET",headers:H(t)}),{params:Promise.resolve({patientId:p})});return{status:r.status,body:await r.json()};}
// Contrato de la remediación (auditoría C-03/C-05, lote 1): con barreras NO verificables (paciente sintético sin edad, peso o
// eGFR) PRESCRIBE responde 428 hasta que el médico confirma y justifica. Las barreras BLOQUEADAS siguen devolviendo 403.
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();const p=crypto.randomUUID();const other=crypto.randomUUID();
 await reg(phys,p);await reg(phys,other);
 await res(phys,p,"GLUCOSE","520");await res(phys,other,"HBA1C","6.0"); // el de 'other' no debe aparecer
 await order(phys,p,"LAB","Biometría hemática completa");
 await medActive(phys,p,"metformina");await medActive(phys,p,"losartan");
 await goal(phys,p,"DIABETES","Lograr HbA1c < 7% en 3 meses");
 await doc(phys,p,"PROGRESS_NOTE","Nota_consulta.pdf");
 await obl(phys,p,"Solicitar HbA1c en 3 meses");

 const T=await tabs(phys,p);ok(T.status===200,"TABS_200");
 const b=T.body as{results:{analyte:string;estado:string}[];orders:{detail:string;typeLabel:string}[];medications:string[];planGoals:{goal:string}[];documents:{title:string;typeLabel:string}[];obligations:{task:string;done:boolean}[]};
 // resultados del paciente (aislamiento: solo GLUCOSE, no el HBA1C de 'other')
 ok(b.results.length===1&&b.results[0]!.analyte==="GLUCOSE"&&b.results[0]!.estado==="Hallazgos","RESULTS_PATIENT_ISOLATED");
 // órdenes
 ok(b.orders.length===1&&b.orders[0]!.typeLabel==="Laboratorio","ORDERS");
 // medicamentos por nombre
 ok(b.medications.includes("metformina")&&b.medications.includes("losartan"),"MEDS_NAMED");
 // plan
 ok(b.planGoals.length===1&&b.planGoals[0]!.goal.includes("HbA1c"),"PLAN_GOAL");
 // documentos
 ok(b.documents.length===1&&b.documents[0]!.typeLabel==="Nota médica","DOC");
 // obligaciones (la manual + las de monitoreo auto-generadas al activar metformina/losartán -> comportamiento real del sistema)
 ok(b.obligations.some(x=>x.task==="Solicitar HbA1c en 3 meses"),"OBLIGATION_MANUAL");
 ok(b.obligations.some(x=>x.task==="MONITOR_RENAL")&&b.obligations.some(x=>x.task==="MONITOR_K_CREAT"),"OBLIGATION_AUTO_MONITOR");

 // sin scope -> 403
 const noScope=await tabs(tok(["order:write"]),p);ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
