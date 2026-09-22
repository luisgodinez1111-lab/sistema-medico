// EPIC AZ — Evidencia física: rechazar una orden cuya dosis diaria total excede el máximo del fármaco
// (dose ceiling / sobredosis) en el propose. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-az-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["medication:propose","medication:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const ISO="2026-09-13T09:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function propose(t:string,pat:string,drugCode:string,dose:string,frequency:string){return meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:crypto.randomUUID(),patientId:pat,drugCode,dose,route:"VO",frequency,occurredAt:ISO})}));}
try{
 const phys=tok();const pat=crypto.randomUUID();
 // 1) ibuprofeno 800mg c/4h = 4800mg/día > 3200 -> BLOQUEADO 403
 let r=await propose(phys,pat,"ibuprofeno-800","800mg","c/4h");
 ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","IBUPROFEN_OVERDOSE_BLOCKED_403");
 // 2) paracetamol 1g c/4h = 6000mg/día > 4000 -> BLOQUEADO
 r=await propose(phys,pat,"paracetamol-1g","1g","c/4h");
 ok(r.status===403,"PARACETAMOL_OVERDOSE_BLOCKED_403");
 // 3) ibuprofeno 800mg c/8h = 2400mg/día <= 3200 -> PERMITIDO 201
 r=await propose(phys,pat,"ibuprofeno-800","800mg","c/8h");
 ok(r.status===201,"IBUPROFEN_WITHIN_LIMIT_ALLOWED_201");
 // 4) ibuprofeno 800mg c/6h = 3200mg/día = límite exacto -> PERMITIDO
 r=await propose(phys,pat,"ibuprofeno-800","800mg","c/6h");
 ok(r.status===201,"IBUPROFEN_AT_LIMIT_ALLOWED_201");
 // 5) no acotable: ibuprofeno PRN (frecuencia no computable) -> PERMITIDO (fail-open informado)
 r=await propose(phys,pat,"ibuprofeno-400","400mg","PRN");
 ok(r.status===201,"PRN_NOT_BOUNDED_ALLOWED_201");
 // 6) unidad no-masa (gotas) -> no acotable -> PERMITIDO
 r=await propose(phys,pat,"ibuprofeno-gotas","10 gotas","c/6h");
 ok(r.status===201,"NON_MASS_UNIT_ALLOWED_201");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
