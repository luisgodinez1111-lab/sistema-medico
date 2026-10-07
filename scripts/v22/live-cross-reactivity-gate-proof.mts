// EPIC AP — Evidencia física: gate de alergia por CLASE + reactividad cruzada beta-lactámicos contra Neon.
// Demuestra lo que el match por subcadena NO detectaba: alergia a penicilina bloquea amoxicilina Y cefalexina.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const al=await import("../../apps/web/app/api/v1/allergies/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["allergy:write","medication:propose","medication:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});const ISO="2026-09-10T10:00:00.000Z";const idem=()=>crypto.randomUUID();
// Contrato de la remediación (auditoría C-03/C-05, lote 1): con barreras NO verificables (paciente sintético sin edad, peso o
// eGFR) PRESCRIBE responde 428 hasta que el médico confirma y justifica. Las barreras BLOQUEADAS siguen devolviendo 403.
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function proposeRx(t:string,pat:string,drugCode:string){
 const med=crypto.randomUUID();
 await meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:med,patientId:pat,drugCode,dose:"500mg",route:"VO",frequency:"c/8h",occurredAt:ISO})}));
 return rx.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,...ACK})}),MP(med));
}
try{
 const phys=tok();await registerPhysicianCredentials(phys);const pat=crypto.randomUUID();await ensurePatientIn(TA,pat); /* L-07 */
 // alergia ACTIVA a penicilina (no menciona amoxicilina ni cefalexina)
 await al.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:crypto.randomUUID(),patientId:pat,substance:"penicilina",severity:"SEVERE",reaction:"anafilaxia",occurredAt:ISO})}));
 // amoxicilina -> bloqueada por CLASE (penicilina). La subcadena NO lo detectaría.
 let r=await proposeRx(phys,pat,"amoxicilina-500");ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","AMOXICILLIN_BLOCKED_BY_CLASS");
 // cefalexina -> bloqueada por REACTIVIDAD CRUZADA beta-lactámicos.
 r=await proposeRx(phys,pat,"cefalexina-500");ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","CEPHALEXIN_BLOCKED_CROSS_REACTIVITY");
 // ibuprofeno -> sin conflicto con penicilina, se permite.
 r=await proposeRx(phys,pat,"ibuprofeno-400");ok(r.status===201,"IBUPROFEN_ALLOWED");
 // segundo paciente con alergia a AINE -> ibuprofeno bloqueado por clase NSAID.
 const pat2=crypto.randomUUID();await ensurePatientIn(TA,pat2); /* L-07 */
 await al.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:crypto.randomUUID(),patientId:pat2,substance:"AINE",severity:"MODERATE",reaction:"urticaria",occurredAt:ISO})}));
 r=await proposeRx(phys,pat2,"ibuprofeno-400");ok(r.status===403,"IBUPROFEN_BLOCKED_NSAID_CLASS");
 // ...pero amoxicilina se permite para pat2 (sin conflicto con AINE).
 r=await proposeRx(phys,pat2,"amoxicilina-500");ok(r.status===201,"AMOXICILLIN_ALLOWED_FOR_NSAID_ALLERGIC");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
