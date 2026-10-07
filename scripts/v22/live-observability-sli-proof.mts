// EPIC BG (ENG-054) — Evidencia física: un comando clínico real (vía ruta) emite un SLI del commit con
// correlación + latencia, y el evento es PHI-free por construcción (allowlist). vs Neon.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const obs=await import("../../packages/observability/src");
const enc=await import("../../apps/web/app/api/v1/encounters/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["encounter:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const ISO="2026-09-14T09:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const captured:import("../../packages/observability/src").SliEvent[]=[];
const off=obs.onSli(e=>captured.push(e));
try{
 const phys=tok();
 // Abrir un encuentro = un comando del kernel (topic encounter.opened) -> emite un SLI de commit.
 const r=await enc.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:crypto.randomUUID(),patientId:await freshPatient(TA),chiefComplaint:"dolor torácico",occurredAt:ISO})}));
 ok(r.status===201||r.status===200,"ENCOUNTER_OPENED");
 ok(captured.length>=1,"SLI_EMITTED");
 const e=captured[captured.length-1]!;
 ok(e.outcome==="success","SLI_SUCCESS_OUTCOME");
 ok(typeof e.correlationId==="string"&&e.correlationId.length>0,"SLI_HAS_CORRELATION_ID");
 ok(typeof e.latencyMs==="number"&&e.latencyMs>=0,"SLI_HAS_LATENCY");
 ok(!!e.tenantHash&&e.tenantHash!==TA,"SLI_TENANT_HASHED_NOT_RAW");
 // PHI-free por construcción: ninguna clave fuera de la allowlist, y no aparece el chief complaint ni el tenant crudo.
 obs.assertSliPhiFree(e as unknown as Record<string,unknown>);result.checks.push("SLI_PHI_FREE_ALLOWLIST");
 const json=JSON.stringify(e);
 ok(!json.includes("dolor")&&!json.includes(TA),"SLI_NO_PHI_NO_RAW_TENANT");
}catch(e){result.status="FAIL";result.error=String(e);}
finally{off();}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
