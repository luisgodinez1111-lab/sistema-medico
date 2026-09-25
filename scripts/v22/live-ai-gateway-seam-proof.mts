// EPIC R6 (opción B) — Evidencia física: el gateway de IA está CABLEADO detrás de un kill-switch y es fail-closed/HONESTO.
// Verifica, sin fabricar ninguna salida de IA:
//   1) kill-switch OFF -> 503 AI_NOT_ENABLED (nada de IA).
//   2) kill-switch ON + tarea C2 permitida por el envelope -> el proveedor NO existe -> 503 DEPENDENCY_UNAVAILABLE
//      (se ABSTIENE, no inventa salida ni recibo de evidencia).
//   3) tarea C4 -> BLOQUEADA por el envelope (evidencia/aprobación humana) ANTES de llegar al proveedor.
//   4) sin scope ai:write -> 403.
// Así, el día que se implemente `callAiProvider` con un modelo real, los gates ya se ejercitan de verdad. vs local PG.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable)
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const exec=await import("../../apps/web/app/api/v1/ai/execute/route");
const cards=await import("../../apps/web/app/api/v1/ai/task-cards/route");
const envs=await import("../../apps/web/app/api/v1/ai/envelopes/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["ai:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string){return{"content-type":"application/json",authorization:"Bearer "+t,"idempotency-key":crypto.randomUUID()};}
const POST=(t:string,body:Record<string,unknown>)=>new Request("http://l/",{method:"POST",headers:H(t),body:JSON.stringify(body)});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const card=(id:string,risk:string,envelope:string)=>({id,version:"1.0.0",purpose:"TEST_TASK",risk,authority:["ENG-266"],minimumNecessaryFields:["patientId"],outputSchema:"clinical-summary-v1",allowed:["summarize"],prohibited:["sign chart"],evidence:"claim-level source",abstention:"ABSTAIN on insufficient evidence",owner:"AI Gateway + Clinical Safety",evalSuite:"EVAL-TEST-001",killSwitch:true,envelope});
// El schema del envelope exige killSwitch+evidenceRequired=true SIEMPRE; el gate real por tarea lo deriva el handler del
// riesgo de la task card (C2 no exige evidencia; C4/C5 sí), no de este flag del envelope.
const envelope=(id:string,aiTask:string)=>({id,aiTask,supported:["summarize"],preconditions:[],exclusions:[],failureMode:"ABSTAIN",humanApprovalRequired:false,killSwitch:true,evidenceRequired:true});
const execBody=(taskId:string)=>({taskId,tenantId:TA,minimumNecessaryContext:{patientId:crypto.randomUUID()},sensitivity:"low",intendedUse:"prueba de seam",outputSchema:"clinical-summary-v1"});
try{
 const phys=tok();
 // 1) kill-switch OFF (variable ausente) -> 503 AI_NOT_ENABLED
 delete process.env.AI_GATEWAY_ENABLED;
 let r=await exec.POST(POST(phys,execBody("AI-TASK-0002")));
 ok(r.status===503&&(await r.json()).error.code==="AI_NOT_ENABLED","KILLSWITCH_OFF_503");
 // Encender el kill-switch para el resto
 process.env.AI_GATEWAY_ENABLED="true";
 // 2) registrar envelope + tarea C2 y ejecutar -> se ABSTIENE (no hay proveedor), sin fabricar salida
 r=await envs.POST(POST(phys,envelope("SE-0002","AI-TASK-0002")));ok(r.status===201,"ENVELOPE_REGISTERED_201");
 r=await cards.POST(POST(phys,card("AI-TASK-0002","C2","SE-0002")));ok(r.status===201,"TASKCARD_REGISTERED_201");
 r=await exec.POST(POST(phys,execBody("AI-TASK-0002")));const b=await r.json();
 ok(r.status===503&&b.error.code==="DEPENDENCY_UNAVAILABLE","C2_ABSTAINS_NO_PROVIDER_503");
 ok(b.result===undefined&&b.receipt===undefined,"NO_FABRICATED_OUTPUT");
 // 3) tarea C4 -> BLOQUEADA por el envelope (evidencia/aprobación humana) antes del proveedor
 r=await envs.POST(POST(phys,envelope("SE-0003","AI-TASK-0003")));ok(r.status===201,"ENVELOPE_C4_REGISTERED_201");
 r=await cards.POST(POST(phys,card("AI-TASK-0003","C4","SE-0003")));ok(r.status===201,"TASKCARD_C4_REGISTERED_201");
 r=await exec.POST(POST(phys,execBody("AI-TASK-0003")));const b4=await r.json();
 ok(r.status===403&&b4.error.code==="SAFETY_BLOCKED","C4_BLOCKED_BY_ENVELOPE_403");
 // 4) sin scope ai:write -> 403
 r=await exec.POST(POST(tok(["patient:read"]),execBody("AI-TASK-0002")));
 ok(r.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}finally{delete process.env.AI_GATEWAY_ENABLED;}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
