// EPIC AQ/UI — Evidencia física: registro de resultados diagnósticos de toda la clínica (vista Resultados).
// Recibe resultados con valores normales, críticos y de imagen, transiciona uno a ACTIONED, y consulta
// GET /results -> estado-UI derivado (Hallazgos/Normal/En seguimiento) + tipo + KPIs + join del paciente. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-aq-res-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const resVer=await import("../../apps/web/app/api/v1/results/[resultId]/verification/route");
const resAct=await import("../../apps/web/app/api/v1/results/[resultId]/action/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birth(40),sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function res(t:string,p:string,analyte:string,value:string){const id=crypto.randomUUID();const r=await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:id,patientId:p,orderId:crypto.randomUUID(),analyte,value,unit:canonicalUnitOf(analyte)??"n/a",occurredAt:at()})}));const j=await r.json() as{critical?:boolean};return{id,status:r.status,critical:!!j.critical};}
async function verify(t:string,id:string){return resVer.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({resultId:id})});}
async function action(t:string,id:string){return resAct.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+7*86400000).toISOString(),occurredAt:at()})}),{params:Promise.resolve({resultId:id})});}
async function list(t:string){const r=await resR.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();const p1=crypto.randomUUID(),p2=crypto.randomUUID();
 await reg(phys,p1,"Ana López García");await reg(phys,p2,"Carlos Mendoza");
 // creatinina normal, glucosa muy alta (crítica/panic), radiografía (imagen)
 const rNorm=await res(phys,p1,"CREATININE","0.9");
 const rCrit=await res(phys,p2,"GLUCOSE","520");
 const rImg=await res(phys,p1,"Radiografía de tórax","Sin alteraciones");
 ok(rNorm.status===201&&rCrit.status===201,"RECEIVE_201");
 ok(rCrit.critical===true,"GLUCOSE_CRITICAL_DERIVED");

 // llevar el normal a ACTIONED (verify -> action) para el estado 'En seguimiento'
 const vr=await verify(phys,rNorm.id);ok(vr.status===200||vr.status===201,"VERIFY_OK");
 const ar=await action(phys,rNorm.id);ok(ar.status===200||ar.status===201,"ACTION_OK");

 const L=await list(phys);ok(L.status===200,"LIST_200");
 const b=L.body as{total:number;abnormal:number;enSeguimiento:number;pendientes:number;items:{analyte:string;estado:string;tipo:string;patientName:string;critical:boolean}[]};
 ok(b.total===3,"TOTAL_3");
 const byA=(a:string)=>b.items.find(i=>i.analyte===a);
 // estado-UI derivado
 ok(byA("GLUCOSE")?.estado==="Hallazgos","GLUCOSE_HALLAZGOS");
 ok(byA("CREATININE")?.estado==="En seguimiento","CREATININE_EN_SEGUIMIENTO");
 ok(byA("Radiografía de tórax")?.tipo==="Imagenología","RADIO_IMAGENOLOGIA");
 // join del paciente
 ok(byA("GLUCOSE")?.patientName==="Carlos Mendoza","PATIENT_JOIN");
 // KPIs: 1 con hallazgos (glucosa), 1 en seguimiento (creatinina ACTIONED), 2 pendientes de revisión (glucosa+radiografía en RECEIVED)
 ok(b.abnormal===1&&b.enSeguimiento===1&&b.pendientes===2,"KPIS");

 // sin scope -> 403
 const noScope=await list(tok(["patient:read"]));
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
