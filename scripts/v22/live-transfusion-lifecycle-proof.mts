// EPIC AJ — Evidencia física de la transfusión (ordenar/cruzar/iniciar/completar/reacción/cancelar) contra Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-aj-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const tf=await import("../../apps/web/app/api/v1/transfusions/route");
const cm=await import("../../apps/web/app/api/v1/transfusions/[transfusionId]/crossmatch/route");
const st=await import("../../apps/web/app/api/v1/transfusions/[transfusionId]/start/route");
const co=await import("../../apps/web/app/api/v1/transfusions/[transfusionId]/completion/route");
const rx=await import("../../apps/web/app/api/v1/transfusions/[transfusionId]/reaction/route");
const cn=await import("../../apps/web/app/api/v1/transfusions/[transfusionId]/cancellation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["transfusion:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({transfusionId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await tf.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({transfusionId:id,patientId:crypto.randomUUID(),bloodProduct:"PRBC",units:"2",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const nurse=tok(TA);
 // ordenar -> cruzar -> iniciar -> completar
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="ORDERED","ORDER_201");
 r=await cm.POST(new Request("http://l/",B(nurse,1)),PP(id));ok(r.status===201&&(await r.json()).state==="CROSSMATCHED","CROSSMATCH_201");
 r=await st.POST(new Request("http://l/",B(nurse,2)),PP(id));ok(r.status===201&&(await r.json()).state==="TRANSFUSING","START_201");
 r=await co.POST(new Request("http://l/",B(nurse,3)),PP(id));ok(r.status===201&&(await r.json()).state==="COMPLETED","COMPLETE_201");
 // SM: iniciar sin cruzar -> 409
 const two=await mk(nurse);
 r=await st.POST(new Request("http://l/",B(nurse,1)),PP(two.id));ok(r.status===409,"START_WITHOUT_CROSSMATCH_409");
 // camino de reacción: ordenar -> cruzar -> iniciar -> REACCIÓN
 const three=await mk(nurse);
 await cm.POST(new Request("http://l/",B(nurse,1)),PP(three.id));
 await st.POST(new Request("http://l/",B(nurse,2)),PP(three.id));
 r=await rx.POST(new Request("http://l/",B(nurse,3,{reaction:"Fiebre + escalofríos"})),PP(three.id));ok(r.status===201&&(await r.json()).state==="REACTION","REACTION_201");
 // SM: completar tras reacción (terminal) -> 409
 r=await co.POST(new Request("http://l/",B(nurse,4)),PP(three.id));ok(r.status===409,"COMPLETE_AFTER_REACTION_409");
 // cancelar desde ORDERED
 const four=await mk(nurse);
 r=await cn.POST(new Request("http://l/",B(nurse,1,{reason:"Ya no requerida"})),PP(four.id));ok(r.status===201&&(await r.json()).state==="CANCELLED","CANCEL_201");
 // cross-tenant -> 404
 const nurseB=tok(TB);
 r=await cm.POST(new Request("http://l/",B(nurseB,1)),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope transfusion:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await tf.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({transfusionId:crypto.randomUUID(),patientId:crypto.randomUUID(),bloodProduct:"FFP",units:"1",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
