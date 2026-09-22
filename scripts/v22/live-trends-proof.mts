// EPIC CH — Evidencia física: evolución longitudinal (panel 4) — series temporales de analitos + últimos
// valores, desde resultados sembrados en el tiempo. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-ch-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const trR=await import("../../apps/web/app/api/v1/patients/[patientId]/trends/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=86400000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number,sex:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:sex,occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,occurredAt:at()})}));}
async function get(t:string,p:string){const r=await trR.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 const p=crypto.randomUUID();await reg(phys,p,54,"FEMALE");
 for(const v of["8.2","7.5","7.1"])await res(phys,p,"HBA1C",v); // orden temporal ascendente
 await res(phys,p,"LDL","98");
 await res(phys,p,"CREATININE","1.3");
 const g=await get(phys,p);
 ok(g.status===200,"TRENDS_200");
 const s=g.body.series.HBA1C as {value:number;at:string}[];
 ok(Array.isArray(s)&&s.length===3,"HBA1C_SERIES_3");
 ok(s[0]!.value===8.2&&s[1]!.value===7.5&&s[2]!.value===7.1,"HBA1C_ASCENDING_ORDER");
 ok(Date.parse(s[0]!.at)<Date.parse(s[2]!.at),"SERIES_TIME_SORTED");
 ok(g.body.latest.LDL===98,"LATEST_LDL");
 ok(typeof g.body.latest.CREATININE==="number","LATEST_CREATININE");
 ok(typeof g.body.latest.EGFR==="number","LATEST_EGFR_COMPUTED");
 // sin scope -> 403
 const noScope=tok(["result:write"]);const g3=await get(noScope,p);ok(g3.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
