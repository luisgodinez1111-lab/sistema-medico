// EPIC BA — Evidencia física: al prescribir un fármaco que exige vigilancia, el sistema crea automáticamente
// una obligación de monitoreo (Zero-Lost-Follow-Up). Cross-vertical medicación→obligación. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-ba-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{derivedUuid}=await import("../../apps/web/lib/http-command");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const oprog=await import("../../apps/web/app/api/v1/obligations/[obligationId]/progress/route");
const ocomp=await import("../../apps/web/app/api/v1/obligations/[obligationId]/completion/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["medication:propose","medication:write","obligation:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});const OP=(id:string)=>({params:Promise.resolve({obligationId:id})});
const ISO="2026-09-14T09:00:00.000Z";const idem=()=>crypto.randomUUID();
// Contrato de la remediación (auditoría C-03/C-05, lote 1): con barreras NO verificables (paciente sintético sin edad, peso o
// eGFR) PRESCRIBE responde 428 hasta que el médico confirma y justifica. Las barreras BLOQUEADAS siguen devolviendo 403.
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function propose(t:string,pat:string,drugCode:string,dose:string,frequency:string){const id=crypto.randomUUID();await meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:pat,drugCode,dose,route:"VO",frequency,occurredAt:ISO})}));return id;}
// prescribe con una idempotency-key CONOCIDA para poder derivar el id de la obligación auto-creada.
async function prescribe(t:string,medId:string,key:string){return rx.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":key,"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,...ACK})}),MP(medId));}
try{
 const phys=tok();const pat=crypto.randomUUID();
 // 1) warfarina -> al prescribir se crea la obligación MONITOR_INR (agg slot 0)
 const w=await propose(phys,pat,"warfarina-5","5mg","c/24h");
 const kW=idem();let r=await prescribe(phys,w,kW);ok(r.status===201,"WARFARIN_PRESCRIBED_201");
 const oblW=derivedUuid(kW,"monitor-agg-0");
 // la obligación existe y es operable: arrancarla (OPEN v1 -> IN_PROGRESS) devuelve 201
 r=await oprog.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),OP(oblW));
 ok(r.status===201,"MONITOR_INR_OBLIGATION_CREATED_AND_STARTED_201");
 // completar EXIGE evidencia -> cierra el lazo (v2 -> COMPLETED)
 r=await ocomp.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({evidence:"INR 2.4 en rango",occurredAt:ISO})}),OP(oblW));
 ok(r.status===201&&(await r.json()).state==="COMPLETED","MONITOR_INR_OBLIGATION_COMPLETED_201");
 // 2) metformina -> MONITOR_RENAL
 const m=await propose(phys,pat,"metformina-850","850mg","c/12h");
 const kM=idem();r=await prescribe(phys,m,kM);ok(r.status===201,"METFORMIN_PRESCRIBED_201");
 r=await oprog.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),OP(derivedUuid(kM,"monitor-agg-0")));
 ok(r.status===201,"MONITOR_RENAL_OBLIGATION_CREATED_201");
 // 3) ibuprofeno -> SIN monitoreo: no se crea obligación (arrancar el id derivado -> 404 NOT_FOUND)
 const ib=await propose(phys,pat,"ibuprofeno-400","400mg","c/8h");
 const kI=idem();r=await prescribe(phys,ib,kI);ok(r.status===201,"IBUPROFEN_PRESCRIBED_201");
 r=await oprog.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),OP(derivedUuid(kI,"monitor-agg-0")));
 ok(r.status===404,"NO_MONITORING_NO_OBLIGATION_404");
 // 4) idempotencia: re-prescribir (replay) NO duplica la obligación (sigue operable en su versión, no re-crea)
 r=await prescribe(phys,w,kW);ok(r.status===200&&(await r.json()).replayed===true,"PRESCRIBE_REPLAY_200_NO_DUP");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
