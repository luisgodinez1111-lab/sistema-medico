// EPIC CB (ADR-0220 fase 1) — Evidencia física del choke point del copilot SIN IA. vs Neon.
// Verifica: kill-switch OFF por defecto, autoridad humana (PRESCRIBE bloqueado), presupuesto (críticos abiertos),
// y stub DETERMINISTA (SUMMARIZE devuelve el resumen, provenance AI_SUGGESTED, no promovido, no generativo).
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const vit=await import("../../apps/web/app/api/v1/vitals/route");
const ai=await import("../../apps/web/app/api/v1/ai/assist/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["ai:invoke","patient:write","vital:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function assist(t:string,body:unknown){const r=await ai.POST(new Request("http://l/",{method:"POST",headers:H(t),body:JSON.stringify(body)}));return{status:r.status,body:await r.json()};}
async function reg(t:string,p:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:"1980-01-01",sexAtBirth:"MALE",occurredAt:at()})}));}
async function critVital(t:string,p:string){await vit.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType:"SPO2",value:"85",unit:"%",occurredAt:at()})}));}
try{
 const phys=tok();const pat=crypto.randomUUID();await reg(phys,pat);
 // 1) kill-switch OFF por defecto -> 503 DISABLED (aunque la acción sea válida)
 delete process.env.AI_COPILOT_ENABLED;
 let g=await assist(phys,{action:"SUMMARIZE",patientId:pat});ok(g.status===503,"KILL_SWITCH_OFF_503");
 // 2) enciendo el switch (SOLO en esta prueba). PRESCRIBE = autoridad HUMANA -> 403
 process.env.AI_COPILOT_ENABLED="true";
 g=await assist(phys,{action:"PRESCRIBE",patientId:pat});ok(g.status===403&&g.body.error.code==="SAFETY_BLOCKED","HUMAN_AUTHORITY_PRESCRIBE_403");
 g=await assist(phys,{action:"SIGN",patientId:pat});ok(g.status===403,"HUMAN_AUTHORITY_SIGN_403");
 // 3) SUMMARIZE en paciente sano -> ALLOWED, stub determinista, provenance AI_SUGGESTED, no promovido, no generativo
 g=await assist(phys,{action:"SUMMARIZE",patientId:pat});
 ok(g.status===200&&g.body.status==="ALLOWED","SUMMARIZE_ALLOWED_200");
 ok(g.body.provenance==="AI_SUGGESTED"&&g.body.promoted===false&&g.body.generative===false,"AI_SUGGESTED_NOT_PROMOTED_NOT_GENERATIVE");
 ok(Array.isArray(g.body.content.findings)&&g.body.citations[0]==="deterministic-engine","DETERMINISTIC_GROUNDED_CONTENT");
 // 4) presupuesto: paciente con vital crítico abierto -> SAFETY_BLOCKED (no correr IA con críticos)
 const pat2=crypto.randomUUID();await reg(phys,pat2);await critVital(phys,pat2);
 g=await assist(phys,{action:"SUMMARIZE",patientId:pat2});ok(g.status===403&&/OPEN_CRITICAL|bloqueada/i.test(JSON.stringify(g.body)),"BUDGET_OPEN_CRITICAL_BLOCKED");
 // 5) SUGGEST (C4) sin evidencia -> SAFETY_BLOCKED
 g=await assist(phys,{action:"SUGGEST",patientId:pat});ok(g.status===403,"SUGGEST_NO_EVIDENCE_BLOCKED");
 // 6) EXTRACT permitido por los gates pero sin proveedor real -> ABSTAIN (200, no error)
 g=await assist(phys,{action:"EXTRACT",patientId:pat});ok(g.status===200&&g.body.status==="ABSTAIN","EXTRACT_ABSTAIN_NO_PROVIDER");
 // 7) sin scope ai:invoke -> 403
 const noScope=tok(["patient:write"]);g=await assist(noScope,{action:"SUMMARIZE",patientId:pat});ok(g.status===403,"MISSING_SCOPE_403");
 // 8) SHADOW MODE: con shadow ON la respuesta al médico es IDÉNTICA a shadow OFF (invariante de no-fuga)
 delete process.env.AI_COPILOT_SHADOW;const off=await assist(phys,{action:"SUMMARIZE",patientId:pat});
 process.env.AI_COPILOT_SHADOW="true";const on=await assist(phys,{action:"SUMMARIZE",patientId:pat});
 ok(JSON.stringify(off.body)===JSON.stringify(on.body),"SHADOW_DOES_NOT_LEAK_TO_CLINICIAN");
}catch(e){result.status="FAIL";result.error=String(e);}
finally{delete process.env.AI_COPILOT_ENABLED;delete process.env.AI_COPILOT_SHADOW;}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
