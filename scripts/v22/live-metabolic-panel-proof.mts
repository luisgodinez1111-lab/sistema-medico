// EPIC BN — Evidencia física: derivaciones multi-analito (anion gap, calcio corregido) desde los resultados
// del paciente. Cross-analito. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bn-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const resR=await import("../../apps/web/app/api/v1/results/route");
const mp=await import("../../apps/web/app/api/v1/patients/[patientId]/metabolic-panel/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["result:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function res(t:string,p:string,analyte:string,value:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte,value,occurredAt:at()})}));}
async function panel(t:string,p:string){const r=await mp.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) acidosis de brecha aumentada + hipocalcemia enmascarada
 const p1=crypto.randomUUID();
 for(const[a,v]of[["SODIUM","140"],["CHLORIDE","100"],["BICARBONATE","10"],["CALCIUM","8.0"],["ALBUMIN","2.0"]]as const)await res(phys,p1,a,v);
 let g=await panel(phys,p1);ok(g.status===200,"PANEL_200");
 ok(g.body.anionGap&&g.body.anionGap.value===30&&g.body.anionGap.status==="HIGH","ANION_GAP_HIGH_30");
 ok(g.body.correctedCalcium&&g.body.correctedCalcium.corrected===9.6,"CORRECTED_CA_9_6");
 ok(Array.isArray(g.body.missing)&&g.body.missing.length===0,"NOTHING_MISSING");
 // 2) usa el valor MÁS RECIENTE: nuevo bicarbonato normal cambia el anion gap
 await res(phys,p1,"BICARBONATE","24");g=await panel(phys,p1);
 ok(g.body.anionGap.value===16,"USES_LATEST_HCO3"); // 140-100-24=16
 // 3) analitos faltantes -> derivación null + reportada en missing
 const p2=crypto.randomUUID();await res(phys,p2,"SODIUM","140");
 g=await panel(phys,p2);ok(g.body.anionGap===null&&g.body.correctedCalcium===null&&g.body.missing.length===2,"MISSING_REPORTED");
 // 4) aislamiento por paciente: p2 no ve los analitos de p1
 ok(g.body.correctedCalcium===null,"PER_PATIENT_ISOLATION");
 // 5) sin scope patient:read -> 403
 const noScope=tok(["result:write"]);const g3=await panel(noScope,p1);ok(g3.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
