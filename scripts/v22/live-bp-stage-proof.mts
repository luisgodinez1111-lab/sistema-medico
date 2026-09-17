// EPIC BT — Evidencia física: estadificación ACC/AHA de la última presión arterial del paciente. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bt-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const vit=await import("../../apps/web/app/api/v1/vitals/route");
const bs=await import("../../apps/web/app/api/v1/patients/[patientId]/bp-stage/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["vital:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function bp(t:string,p:string,v:string){await vit.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType:"BP",value:v,unit:"mmHg",occurredAt:at()})}));}
async function get(t:string,p:string){const r=await bs.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) 145/92 -> STAGE_2
 const p1=crypto.randomUUID();await bp(phys,p1,"145/92");
 let g=await get(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.stage==="STAGE_2","STAGE_2");
 // 2) usa la MÁS RECIENTE: nueva 118/76 -> NORMAL
 await bp(phys,p1,"118/76");g=await get(phys,p1);ok(g.body.stage==="NORMAL","USES_LATEST_BP");
 // 3) crisis 190/100
 const p2=crypto.randomUUID();await bp(phys,p2,"190/100");
 g=await get(phys,p2);ok(g.body.stage==="CRISIS","CRISIS");
 // 4) sin presión registrada -> no computable
 const p3=crypto.randomUUID();g=await get(phys,p3);ok(g.body.computable===false,"NO_BP_NOT_COMPUTABLE");
 // 5) sin scope patient:read -> 403
 const noScope=tok(["vital:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
