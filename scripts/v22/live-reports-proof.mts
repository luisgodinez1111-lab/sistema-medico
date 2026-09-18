// EPIC AD/UI — Evidencia física: tablero analítico del consultorio (vista Reportes). Siembra pacientes,
// problemas (CIE-10) y facturas (algunas pagadas), y verifica GET /reports -> pacientes atendidos + ingresos
// (facturas pagadas) + diagnósticos principales (top por CIE-10). Determinista, RLS-scoped. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-ad-rep-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const prR=await import("../../apps/web/app/api/v1/problems/route");
const clR=await import("../../apps/web/app/api/v1/claims/route");
const clCode=await import("../../apps/web/app/api/v1/claims/[claimId]/coding/route");
const clSub=await import("../../apps/web/app/api/v1/claims/[claimId]/submission/route");
const clPay=await import("../../apps/web/app/api/v1/claims/[claimId]/payment/route");
const repR=await import("../../apps/web/app/api/v1/reports/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","problem:write","billing:write","record:export"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birth(40),sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function prob(t:string,p:string,code:string){await prR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code,occurredAt:at()})}));}
async function paidClaim(t:string,p:string,amount:string){const id=crypto.randomUUID();await clR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({claimId:id,patientId:p,amount,currency:"MXN",occurredAt:at()})}));await clCode.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({codes:["E11.9"],occurredAt:at()})}),{params:Promise.resolve({claimId:id})});await clSub.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({claimId:id})});await clPay.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({reference:"PAY",occurredAt:at()})}),{params:Promise.resolve({claimId:id})});}
async function reports(t:string){const r=await repR.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();
 const p1=crypto.randomUUID(),p2=crypto.randomUUID(),p3=crypto.randomUUID();
 await reg(phys,p1,"Ana");await reg(phys,p2,"Mateo");await reg(phys,p3,"María");
 // diagnósticos: E11.9 x3, I10 x2, E66.9 x1
 await prob(phys,p1,"E11.9");await prob(phys,p2,"E11.9");await prob(phys,p3,"E11.9");
 await prob(phys,p1,"I10");await prob(phys,p2,"I10");
 await prob(phys,p3,"E66.9");
 // facturas pagadas: 500 + 1200 = 1700
 await paidClaim(phys,p1,"500");await paidClaim(phys,p2,"1200");

 const R=await reports(phys);ok(R.status===200,"REPORTS_200");
 const b=R.body as{patientsAttended:number;income:number;diagnosesTotal:number;topDiagnoses:{code:string;count:number;pct:number}[]};
 ok(b.patientsAttended===3,"PATIENTS_3");
 ok(b.income===1700,"INCOME_1700");
 ok(b.diagnosesTotal===6,"DX_TOTAL_6");
 // top diagnóstico: E11.9 con 3
 ok(b.topDiagnoses[0]!.code==="E11.9"&&b.topDiagnoses[0]!.count===3,"TOP_DX_E119");
 ok(b.topDiagnoses.find(x=>x.code==="I10")?.count===2,"DX_I10_2");
 ok(b.topDiagnoses[0]!.pct===50,"TOP_DX_PCT_50"); // 3/6

 // sin scope -> 403
 const noScope=await reports(tok(["patient:read"]));
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
