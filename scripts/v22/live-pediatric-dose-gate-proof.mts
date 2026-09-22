// EPIC BD — Evidencia física: en un paciente pediátrico (peso registrado), rechazar una orden cuya dosis
// mg/kg/día excede el máximo pediátrico del fármaco. Cross-vertical vitales(peso)→medicación. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bd-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const vitals=await import("../../apps/web/app/api/v1/vitals/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["vital:write","medication:propose","medication:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
let seq=0;const at=()=>new Date(Date.parse("2026-09-14T08:00:00.000Z")+(seq++)*60000).toISOString();
const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function recWeight(t:string,pat:string,kg:string){await vitals.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:pat,vitalType:"WEIGHT",value:kg,unit:"kg",occurredAt:at()})}));}
async function propose(t:string,pat:string,drugCode:string,dose:string,frequency:string){return meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:crypto.randomUUID(),patientId:pat,drugCode,dose,route:"VO",frequency,occurredAt:at()})}));}
try{
 const phys=tok();
 // 1) niño 10kg -> paracetamol 300mg c/6h = 120 mg/kg/día > 75 -> BLOQUEADO 403
 const c1=crypto.randomUUID();await recWeight(phys,c1,"10");
 let r=await propose(phys,c1,"paracetamol-300","300mg","c/6h");
 ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","PEDS_OVERDOSE_BLOCKED_403");
 // 2) niño 10kg -> paracetamol 150mg c/8h = 45 mg/kg/día <= 75 -> PERMITIDO 201
 r=await propose(phys,c1,"paracetamol-150","150mg","c/8h");
 ok(r.status===201,"PEDS_WITHIN_LIMIT_ALLOWED_201");
 // 3) adulto 70kg -> ibuprofeno 800mg c/6h = 3200mg/día (dentro del absoluto) y NO se aplica mg/kg -> PERMITIDO
 const a1=crypto.randomUUID();await recWeight(phys,a1,"70");
 r=await propose(phys,a1,"ibuprofeno-800","800mg","c/6h");
 ok(r.status===201,"ADULT_NOT_WEIGHT_GATED_201");
 // 4) sin peso registrado -> no se puede evaluar mg/kg -> PERMITIDO (fail-open)
 const c2=crypto.randomUUID();
 r=await propose(phys,c2,"paracetamol-300","300mg","c/6h");
 ok(r.status===201,"NO_WEIGHT_NOT_BLOCKED_201");
 // 5) el ceiling absoluto (AZ) sigue activo aun en niño: dosis absurda de ibuprofeno también bloquea
 const c3=crypto.randomUUID();await recWeight(phys,c3,"12");
 r=await propose(phys,c3,"ibuprofeno-800","800mg","c/4h"); // 160 mg/kg/día peds y 4800mg/día absoluto
 ok(r.status===403,"PEDS_AND_ABSOLUTE_BOTH_BLOCK_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
