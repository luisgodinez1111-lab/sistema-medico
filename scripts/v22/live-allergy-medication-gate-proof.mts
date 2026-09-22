// EPIC R — Evidencia física: ciclo de vida de alergia + GATE alergia->prescripción contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-r-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const al=await import("../../apps/web/app/api/v1/allergies/route");
const alInact=await import("../../apps/web/app/api/v1/allergies/[allergyId]/inactivation/route");
const alReact=await import("../../apps/web/app/api/v1/allergies/[allergyId]/reactivation/route");
const alRef=await import("../../apps/web/app/api/v1/allergies/[allergyId]/refutation/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,scopes=["allergy:write","medication:propose","medication:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const AP=(id:string)=>({params:Promise.resolve({allergyId:id})});const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});
const ISO="2026-09-10T10:00:00.000Z";const idem=()=>crypto.randomUUID();
// Contrato de la remediación (auditoría C-03/C-05, lote 1): con barreras NO verificables (paciente sintético sin edad, peso o
// eGFR) PRESCRIBE responde 428 hasta que el médico confirma y justifica. Las barreras BLOQUEADAS siguen devolviendo 403.
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok(TA);await registerPhysicianCredentials(phys);const pat=crypto.randomUUID();
 // Registrar alergia a amoxicilina
 const alg=crypto.randomUUID();
 let r=await al.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:alg,patientId:pat,substance:"amoxicilina",severity:"SEVERE",reaction:"anafilaxia",occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).state==="ACTIVE","ALLERGY_ACTIVE_201");
 // Proponer amoxicilina-500 para ese paciente
 const med=crypto.randomUUID();
 await meds.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:med,patientId:pat,drugCode:"amoxicilina-500",dose:"500mg",route:"VO",frequency:"c/8h",occurredAt:ISO})}));
 // *** GATE *** prescribir -> BLOQUEADO 403 por alergia activa
 r=await rx.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,...ACK})}),MP(med));
 ok(r.status===403,"PRESCRIBE_BLOCKED_BY_ALLERGY_403");
 // Inactivar la alergia
 r=await alInact.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),AP(alg));
 ok(r.status===201&&(await r.json()).state==="INACTIVE","ALLERGY_INACTIVATED_201");
 // Prescribir de nuevo -> AHORA 201
 r=await rx.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,...ACK})}),MP(med));
 ok(r.status===201&&(await r.json()).state==="PRESCRIBED","PRESCRIBE_UNBLOCKED_AFTER_INACTIVATE_201");
 // Reactivar alergia + SM
 r=await alReact.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),AP(alg));
 ok(r.status===201&&(await r.json()).state==="ACTIVE","ALLERGY_REACTIVATED_201");
 r=await alRef.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({occurredAt:ISO})}),AP(alg));
 ok(r.status===201&&(await r.json()).state==="REFUTED","ALLERGY_REFUTED_201");
 // refutada es terminal -> reactivar 409
 r=await alReact.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"4"}),body:JSON.stringify({occurredAt:ISO})}),AP(alg));
 ok(r.status===409,"REACTIVATE_REFUTED_ILLEGAL_409");
 // cross-tenant
 const physB=tok(TB);await registerPhysicianCredentials(physB);
 r=await alInact.POST(new Request("http://l/",{method:"POST",headers:H(physB,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),AP(alg));
 ok(r.status===404,"CROSS_TENANT_404");
 // sin scope
 const noScope=tok(TA,["encounter:read"]);
 r=await al.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:crypto.randomUUID(),patientId:crypto.randomUUID(),substance:"x",severity:"MILD",reaction:"y",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
