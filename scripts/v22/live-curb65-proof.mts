// EPIC BZ — Evidencia física: CURB-65 desde BUN + FR/PA + edad. Cross-vertical labs+vitales+demografía. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bz-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const vit=await import("../../apps/web/app/api/v1/vitals/route");
const cb=await import("../../apps/web/app/api/v1/patients/[patientId]/curb65/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write","vital:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000/* reloj RELATIVO: las calculadoras rechazan datos obsoletos; una fecha fija haría caducar la prueba */;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const U:Record<string,string>={RESP:"rpm",BP:"mmHg"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:"Prueba",birthDate:birth(y),sexAtBirth:"MALE",occurredAt:at()})}));}
async function bun(t:string,p:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:"BUN",value:v,occurredAt:at()})}));}
async function vital(t:string,p:string,vt:string,v:string){await vit.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType:vt,value:v,unit:U[vt]??"u",occurredAt:at()})}));}
async function get(t:string,p:string){const r=await cb.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) 70a con BUN 25 (urea+), FR 32 (resp+), PA 120/80, edad>=65 -> score 3, HIGH (ingreso)
 const p1=crypto.randomUUID();await reg(phys,p1,70);await bun(phys,p1,"25");await vital(phys,p1,"RESP","32");await vital(phys,p1,"BP","120/80");
 let g=await get(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.score===3&&g.body.risk==="HIGH","SCORE_3_HIGH");
 ok(/ingreso/i.test(g.body.recommendation),"ADMIT_RECOMMENDED");
 // 2) 40a estable: BUN 10, FR 18, PA 120/80 -> score 0, LOW (ambulatorio)
 const p2=crypto.randomUUID();await reg(phys,p2,40);await bun(phys,p2,"10");await vital(phys,p2,"RESP","18");await vital(phys,p2,"BP","120/80");
 g=await get(phys,p2);ok(g.body.score===0&&g.body.risk==="LOW","SCORE_0_LOW");
 // 3) usa la PA MÁS RECIENTE: hipotensión 85/55 -> sube el score (bp+)
 await vital(phys,p2,"BP","85/55");g=await get(phys,p2);ok(g.body.criteria.bp===1&&g.body.score===1,"USES_LATEST_BP");
 // 4) falta BUN -> no computable
 const p3=crypto.randomUUID();await reg(phys,p3,60);await vital(phys,p3,"RESP","18");await vital(phys,p3,"BP","120/80");
 g=await get(phys,p3);ok(g.body.computable===false&&/BUN/.test(g.body.reason),"MISSING_BUN");
 // 5) no registrado -> 404
 g=await get(phys,crypto.randomUUID());ok(g.status===404,"UNREGISTERED_404");
 // 6) sin scope -> 403
 const noScope=tok(["result:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
