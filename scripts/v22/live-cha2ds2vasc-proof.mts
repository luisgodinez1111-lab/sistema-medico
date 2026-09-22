// EPIC BQ — Evidencia física: CHA₂DS₂-VASc desde la lista de problemas + demografía -> indicación de anticoagulación. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bq-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const prob=await import("../../apps/web/app/api/v1/problems/route");
const ch=await import("../../apps/web/app/api/v1/patients/[patientId]/cha2ds2vasc/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","problem:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number,sex:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:sex,occurredAt:at()})}));}
async function dx(t:string,p:string,code:string){await prob.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code,occurredAt:at()})}));}
async function get(t:string,p:string){const r=await ch.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) hombre 80 (edad 2) con FA(I48.9)+HTA(I10)+DM(E11)+IC(I50.9) = 2+1+1+1 = 5 -> HIGH, aplicable
 const p1=crypto.randomUUID();await reg(phys,p1,80,"MALE");
 for(const c of["I48.9","I10","E11","I50.9"])await dx(phys,p1,c);
 let g=await get(phys,p1);ok(g.status===200,"COMPUTED_200");
 ok(g.body.score===5&&g.body.risk==="HIGH","SCORE_5_HIGH");
 ok(g.body.applicable===true,"AFIB_APPLICABLE");
 ok(/recomendada/i.test(g.body.recommendation),"ANTICOAG_RECOMMENDED");
 ok(g.body.annualStrokeRiskPct>0,"HAS_ANNUAL_RISK");
 // 2) hombre 50 sin factores -> score 0, LOW
 const p2=crypto.randomUUID();await reg(phys,p2,50,"MALE");
 g=await get(phys,p2);ok(g.body.score===0&&g.body.risk==="LOW","SCORE_0_LOW");
 // 3) sin FA registrada -> nota de aplicabilidad
 ok(g.body.applicable===false&&/fibrilaci/i.test(g.body.note),"NO_AFIB_NOTE");
 // 4) mujer 70 con HTA -> edad(1)+HTA(1)+sexo(1)=3 -> HIGH
 const p3=crypto.randomUUID();await reg(phys,p3,70,"FEMALE");await dx(phys,p3,"I10");
 g=await get(phys,p3);ok(g.body.score===3&&g.body.risk==="HIGH","FEMALE_SCORE_3_HIGH");
 // 5) paciente no registrado -> 404
 g=await get(phys,crypto.randomUUID());ok(g.status===404,"UNREGISTERED_404");
 // 6) sin scope patient:read -> 403
 const noScope=tok(["problem:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
