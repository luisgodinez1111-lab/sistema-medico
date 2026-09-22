// EPIC CD — Evidencia física: índice de Charlson desde la lista de problemas + edad. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-cd-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const prob=await import("../../apps/web/app/api/v1/problems/route");
const ch=await import("../../apps/web/app/api/v1/patients/[patientId]/charlson/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","problem:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:"MALE",occurredAt:at()})}));}
async function dx(t:string,p:string,c:string){await prob.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code:c,occurredAt:at()})}));}
async function get(t:string,p:string){const r=await ch.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) 75a con IC(I50)+EPOC(J44)+ERC(N18) = 3(edad)+1+1+2 = 7, SEVERE
 const p1=crypto.randomUUID();await reg(phys,p1,75);
 for(const c of["I50.9","J44.9","N18.3"])await dx(phys,p1,c);
 let g=await get(phys,p1);ok(g.status===200,"COMPUTED_200");
 ok(g.body.score===7&&g.body.risk==="SEVERE","SCORE_7_SEVERE");
 ok(g.body.ageScore===3&&g.body.comorbidityScore===4,"AGE_AND_COMORBIDITY_SPLIT");
 ok(g.body.components.renal===2,"RENAL_WEIGHT_2");
 ok(g.body.estimated10yrSurvivalPct>=0&&g.body.estimated10yrSurvivalPct<=100,"HAS_SURVIVAL_ESTIMATE");
 // 2) 40a sano -> score 0, LOW
 const p2=crypto.randomUUID();await reg(phys,p2,40);
 g=await get(phys,p2);ok(g.body.score===0&&g.body.risk==="LOW","SCORE_0_LOW");
 // 3) diabetes simple cuenta 1
 const p3=crypto.randomUUID();await reg(phys,p3,40);await dx(phys,p3,"E11");
 g=await get(phys,p3);ok(g.body.components.diabetes===1&&g.body.score===1,"DIABETES_SIMPLE_1");
 // 4) no registrado -> 404; sin scope -> 403
 g=await get(phys,crypto.randomUUID());ok(g.status===404,"UNREGISTERED_404");
 const noScope=tok(["problem:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
