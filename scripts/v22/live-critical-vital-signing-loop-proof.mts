// EPIC AS — Evidencia física: un signo vital CRÍTICO bloquea la firma del encuentro, y crear una obligación
// de seguimiento ligada al vital (sourceVitalId) la DESBLOQUEA (cierra el lazo Zero Lost Follow-Up). vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-as-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const vt=await import("../../apps/web/app/api/v1/vitals/route");
const open=await import("../../apps/web/app/api/v1/encounters/route");
const assess=await import("../../apps/web/app/api/v1/encounters/[encounterId]/assessment/route");
const sign=await import("../../apps/web/app/api/v1/encounters/[encounterId]/signature/route");
const obl=await import("../../apps/web/app/api/v1/obligations/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["encounter:write","encounter:read","vital:write","obligation:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const EP=(id:string)=>({params:Promise.resolve({encounterId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const B=(t:string,v:number,body:Record<string,unknown>={})=>new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const phys=tok();const pat=crypto.randomUUID();const vid=crypto.randomUUID();const enc=crypto.randomUUID();
 // 1) signo vital CRÍTICO (crisis hipertensiva) para el paciente
 let r=await vt.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:vid,patientId:pat,vitalType:"BP",value:"190/125",unit:"mmHg",occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).critical===true,"VITAL_CRITICAL_RECORDED");
 // 2) abrir encuentro y llevar a READY_TO_SIGN
 await open.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc,patientId:pat,occurredAt:ISO})}));
 r=await assess.POST(B(phys,1,{assessment:"Dx",plan:"Plan"}),EP(enc));ok(r.status===201&&(await r.json()).status==="READY_TO_SIGN","ENCOUNTER_READY");
 // 3) firmar -> BLOQUEADO por el vital crítico sin atender (Zero Lost Follow-Up)
 r=await sign.POST(B(phys,2),EP(enc));ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","SIGN_BLOCKED_BY_CRITICAL_VITAL_403");
 // 4) atender el vital: obligación de seguimiento ligada (sourceVitalId=vid)
 r=await obl.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:crypto.randomUUID(),patientId:pat,ownerId:crypto.randomUUID(),dueAt:"2026-09-18T11:00:00.000Z",kind:"CRITICAL_VITAL_FOLLOWUP",sourceVitalId:vid,occurredAt:ISO})}));
 ok(r.status===201,"FOLLOWUP_OBLIGATION_CREATED");
 // 5) firmar de nuevo -> DESBLOQUEADO
 r=await sign.POST(B(phys,2),EP(enc));const s=await r.json();ok(r.status===201&&s.status==="SIGNED","SIGN_UNBLOCKED_AFTER_FOLLOWUP_201");
 // 6) control: otro paciente con vital crítico y SIN obligación sigue bloqueado
 const pat2=crypto.randomUUID();const enc2=crypto.randomUUID();
 await vt.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:pat2,vitalType:"SPO2",value:"85",unit:"%",occurredAt:ISO})}));
 await open.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:enc2,patientId:pat2,occurredAt:ISO})}));
 await assess.POST(B(phys,1,{assessment:"Dx",plan:"Plan"}),EP(enc2));
 r=await sign.POST(B(phys,2),EP(enc2));ok(r.status===403,"OTHER_PATIENT_STILL_BLOCKED_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
