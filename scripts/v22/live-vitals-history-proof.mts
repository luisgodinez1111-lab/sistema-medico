// EPIC W/UI — Evidencia física: historial de signos vitales de un paciente (vista Signos vitales). Registra
// varias tomas (BP/HR/RESP/TEMP/SPO2/WEIGHT/HEIGHT con el mismo occurredAt por toma) y consulta
// GET /patients/:id/vitals -> filas agrupadas por toma + IMC derivado + series de tendencia. RLS-scoped. vs Neon.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const vitR=await import("../../apps/web/app/api/v1/vitals/route");
const vhR=await import("../../apps/web/app/api/v1/patients/[patientId]/vitals/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","vital:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Ana López García ${p.slice(0,8)}`,birthDate:birth(34),sexAtBirth:"FEMALE",occurredAt:new Date().toISOString()})}));}
async function vital(t:string,p:string,vitalType:string,value:string,unit:string,at:string){return vitR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType,value,unit,occurredAt:at})}));}
// una "toma" = varios tipos con el MISMO occurredAt
async function toma(t:string,p:string,at:string,bp:string,hr:string,resp:string,temp:string,spo2:string,weight:string,height:string){
 await vital(t,p,"BP",bp,"mmHg",at);await vital(t,p,"HR",hr,"lpm",at);await vital(t,p,"RESP",resp,"rpm",at);
 await vital(t,p,"TEMP",temp,"°C",at);await vital(t,p,"SPO2",spo2,"%",at);await vital(t,p,"WEIGHT",weight,"kg",at);await vital(t,p,"HEIGHT",height,"cm",at);
}
async function hist(t:string,p:string){const r=await vhR.GET(new Request("http://l/",{method:"GET",headers:H(t)}),{params:Promise.resolve({patientId:p})});return{status:r.status,body:await r.json()};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();const p=crypto.randomUUID();await reg(phys,p);
 // 3 tomas en fechas distintas
 await toma(phys,p,"2026-08-25T10:10:00.000Z","126/84","78","17","36.7","98","68.0","149");
 await toma(phys,p,"2026-09-01T11:02:00.000Z","122/78","74","16","36.6","99","66.8","149");
 await toma(phys,p,"2026-09-17T10:24:00.000Z","120/80","72","16","36.5","98","65.7","149");

 const L=await hist(phys,p);ok(L.status===200,"HIST_200");
 const b=L.body as{count:number;records:{at:string;ta:string;fc:string;imc:string;peso:string}[];series:{BP:{value:number}[];WEIGHT:{value:number}[];IMC:{value:number}[]};latest:{ta:string;imc:string}};
 ok(b.count===3,"THREE_TOMAS");
 // filas agrupadas: la más reciente primero
 ok(b.records[0]!.ta==="120/80"&&b.records[0]!.fc==="72","LATEST_ROW_GROUPED");
 // IMC derivado: 65.7 / 1.49^2 = 29.6
 ok(b.records[0]!.imc==="29.6","IMC_DERIVED_296");
 ok(b.latest.imc==="29.6"&&b.latest.ta==="120/80","LATEST_SUMMARY");
 // series de tendencia ascendentes: TA sistólica 126 -> 122 -> 120
 ok(b.series.BP.length===3&&b.series.BP[0]!.value===126&&b.series.BP[2]!.value===120,"BP_SERIES_ASC");
 ok(b.series.WEIGHT.length===3&&b.series.WEIGHT[2]!.value===65.7,"WEIGHT_SERIES");
 ok(b.series.IMC.length===3,"IMC_SERIES");

 // aislamiento: otro paciente sin vitales -> vacío
 const p2=crypto.randomUUID();await reg(phys,p2);
 const L2=await hist(phys,p2);ok(L2.body.count===0,"OTHER_PATIENT_EMPTY");

 // sin scope -> 403
 const noScope=await hist(tok(["vital:write"]),p);
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
