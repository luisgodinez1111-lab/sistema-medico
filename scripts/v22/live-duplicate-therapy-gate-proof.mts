// EPIC AW — Evidencia física: no prescribir un fármaco de la MISMA clase que uno ya activo (duplicación terapéutica). vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-aw-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const act=await import("../../apps/web/app/api/v1/medications/[medicationId]/activation/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["medication:propose","medication:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
// Contrato de la remediación (auditoría C-03/C-05, lote 1): con barreras NO verificables (paciente sintético sin edad, peso o
// eGFR) PRESCRIBE responde 428 hasta que el médico confirma y justifica. Las barreras BLOQUEADAS siguen devolviendo 403.
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const drug={dose:"400mg",route:"VO",frequency:"c/12h"};// c/12h: dentro del tope diario de todos los fármacos usados (evita disparar el ceiling AZ)
async function propose(t:string,pat:string,drugCode:string){const id=crypto.randomUUID();await meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:pat,drugCode,...drug,occurredAt:ISO})}));return id;}
const B=(t:string,v:number)=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...ACK})});
try{
 const phys=tok();const pat=crypto.randomUUID();
 // 1) ibuprofeno (AINE): proponer -> prescribir -> ACTIVAR
 const a=await propose(phys,pat,"ibuprofeno-400");
 let r=await rx.POST(new Request("http://l/",B(phys,1)),MP(a));ok(r.status===201,"IBUPROFEN_PRESCRIBED_201");
 r=await act.POST(new Request("http://l/",B(phys,2)),MP(a));ok(r.status===201&&(await r.json()).state==="ACTIVE","IBUPROFEN_ACTIVE_201");
 // 2) naproxeno (AINE, misma clase): proponer -> prescribir -> BLOQUEADO por duplicación
 const b=await propose(phys,pat,"naproxeno-500");
 r=await rx.POST(new Request("http://l/",B(phys,1)),MP(b));ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","NAPROXEN_BLOCKED_DUPLICATE_403");
 // 3) amoxicilina (clase distinta): proponer -> prescribir -> PERMITIDO
 const c=await propose(phys,pat,"amoxicilina-500");
 r=await rx.POST(new Request("http://l/",B(phys,1)),MP(c));ok(r.status===201,"AMOXICILLIN_ALLOWED_201");
 // 4) control: otro paciente sin AINE activo -> naproxeno permitido
 const pat2=crypto.randomUUID();const d=await propose(phys,pat2,"naproxeno-500");
 r=await rx.POST(new Request("http://l/",B(phys,1)),MP(d));ok(r.status===201,"NAPROXEN_ALLOWED_OTHER_PATIENT_201");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
