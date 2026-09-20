// EPIC AY — Evidencia física: no prescribir un fármaco contraindicado por una condición ACTIVA del
// paciente (lista de problemas CIE-10). Cross-vertical problema↔prescripción. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-ay-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const pr=await import("../../apps/web/app/api/v1/problems/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["medication:propose","medication:write","problem:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});const ISO="2026-09-12T10:00:00.000Z";const idem=()=>crypto.randomUUID();
// Contrato de la remediación (auditoría C-03/C-05, lote 1): con barreras NO verificables (paciente sintético sin edad, peso o
// eGFR) PRESCRIBE responde 428 hasta que el médico confirma y justifica. Las barreras BLOQUEADAS siguen devolviendo 403.
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const order={dose:"400mg",route:"VO",frequency:"c/8h"};
async function addProblem(t:string,pat:string,code:string){const id=crypto.randomUUID();const r=await pr.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:id,patientId:pat,code,occurredAt:ISO})}));if(r.status!==201)throw new Error("addProblem "+code+" -> "+r.status);return id;}
async function propose(t:string,pat:string,drugCode:string,o=order){const id=crypto.randomUUID();await meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:pat,drugCode,...o,occurredAt:ISO})}));return id;}
const B=(t:string)=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,...ACK})});
try{
 const phys=tok();
 // 1) ERC activa (N18.3) -> prescribir ibuprofeno (AINE) = MAJOR -> BLOQUEADO 403
 const p1=crypto.randomUUID();await addProblem(phys,p1,"N18.3");
 const ib=await propose(phys,p1,"ibuprofeno-400");
 let r=await rx.POST(new Request("http://l/",B(phys)),MP(ib));ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","NSAID_CKD_BLOCKED_403");
 // 2) insuficiencia cardíaca (I50.9) -> naproxeno (AINE) = MAJOR -> BLOQUEADO
 const p2=crypto.randomUUID();await addProblem(phys,p2,"I50.9");
 const np=await propose(phys,p2,"naproxeno-500",{dose:"500mg",route:"VO",frequency:"c/12h"});
 r=await rx.POST(new Request("http://l/",B(phys)),MP(np));ok(r.status===403,"NSAID_HF_BLOCKED_403");
 // 3) ERC (N18.3) + metformina = MODERATE (no bloquea) -> PERMITIDO 201
 const p3=crypto.randomUUID();await addProblem(phys,p3,"N18.3");
 const mf=await propose(phys,p3,"metformina-850",{dose:"850mg",route:"VO",frequency:"c/12h"});
 r=await rx.POST(new Request("http://l/",B(phys)),MP(mf));ok(r.status===201,"METFORMIN_CKD_MODERATE_ALLOWED_201");
 // 4) mismo paciente ERC pero fármaco sin contraindicación (amoxicilina) -> PERMITIDO
 const am=await propose(phys,p1,"amoxicilina-500",{dose:"500mg",route:"VO",frequency:"c/8h"});
 r=await rx.POST(new Request("http://l/",B(phys)),MP(am));ok(r.status===201,"NONCONTRA_DRUG_ALLOWED_201");
 // 5) control: sin condición activa -> ibuprofeno PERMITIDO
 const p5=crypto.randomUUID();const ib2=await propose(phys,p5,"ibuprofeno-400");
 r=await rx.POST(new Request("http://l/",B(phys)),MP(ib2));ok(r.status===201,"NSAID_NO_CONDITION_ALLOWED_201");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
