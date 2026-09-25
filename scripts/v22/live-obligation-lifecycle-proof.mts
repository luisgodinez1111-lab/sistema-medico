// EPIC O — Evidencia física del ciclo de vida de la obligación contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-o-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const obs=await import("../../apps/web/app/api/v1/obligations/route");
const prog=await import("../../apps/web/app/api/v1/obligations/[obligationId]/progress/route");
const comp=await import("../../apps/web/app/api/v1/obligations/[obligationId]/completion/route");
const canc=await import("../../apps/web/app/api/v1/obligations/[obligationId]/cancellation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,scopes=["obligation:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const OP=(id:string)=>({params:Promise.resolve({obligationId:id})});const ISO="2026-08-08T08:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok(TA);const ob=crypto.randomUUID(),pat=crypto.randomUUID();await ensurePatientIn(TA,pat); /* L-07 */
 let r=await obs.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:ob,patientId:pat,ownerId:crypto.randomUUID(),dueAt:"2026-08-15T00:00:00.000Z",kind:"CRITICAL_RESULT_FOLLOWUP",occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).state==="OPEN","CREATE_OPEN_201");
 r=await prog.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),OP(ob));
 ok(r.status===201&&(await r.json()).state==="IN_PROGRESS","PROGRESS_201_v2");
 // completar sin evidencia -> 400
 r=await comp.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),OP(ob));
 ok(r.status===400,"COMPLETE_WITHOUT_EVIDENCE_400");
 // completar con evidencia -> 201
 const idemC=idem();const cReq=()=>new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idemC,"if-match":"2"}),body:JSON.stringify({evidence:"Paciente contactado, resultado informado",occurredAt:ISO})});
 r=await comp.POST(cReq(),OP(ob));ok(r.status===201&&(await r.json()).state==="COMPLETED","COMPLETE_201_v3");
 r=await comp.POST(cReq(),OP(ob));ok(r.status===200&&(await r.json()).replayed===true,"COMPLETE_REPLAY_200");
 // mutar completada -> 409
 r=await canc.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({reason:"x",occurredAt:ISO})}),OP(ob));
 ok(r.status===409,"CANCEL_AFTER_COMPLETED_409");
 // cross-tenant
 const physB=tok(TB);
 r=await prog.POST(new Request("http://l/",{method:"POST",headers:H(physB,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),OP(ob));
 ok(r.status===404,"CROSS_TENANT_404");
 // Auditoría R05a-F04 — el plazo lo decide el SERVIDOR por severidad, no el cliente.
 // Tres casos sobre el mismo endpoint, todos pidiendo 30 días (el tipo de plazo que la pantalla enviaba sin mirar la gravedad):
 const crea=async(body:Record<string,unknown>)=>{const id=crypto.randomUUID();
  const r2=await obs.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:id,patientId:pat,ownerId:crypto.randomUUID(),kind:"FOLLOWUP",occurredAt:ISO,...body})}));
  return await r2.json() as{dueAt?:string;dueAtClamped?:boolean;state?:string};};
 const mas=(h:number)=>new Date(Date.parse(ISO)+h*3600000).toISOString();
 const A30=mas(24*30);
 // 1) URGENTE con 30 días -> recortado a 24 h. Una obligación urgente vencida bloquea la firma: admitir 30 días la vaciaría.
 const urg=await crea({priority:"URGENT",dueAt:A30});
 ok(urg.dueAt===mas(24)&&urg.dueAtClamped===true,"URGENT_OBLIGATION_DUE_CLAMPED_24H");
 // 2) RUTINA con 30 días -> RESPETADO: «solicitar HbA1c en 3 meses» es un seguimiento legítimo, no un plazo que corregir.
 const rut=await crea({priority:"ROUTINE",dueAt:A30});
 ok(rut.dueAt===A30&&rut.dueAtClamped===false,"ROUTINE_OBLIGATION_DUE_RESPECTED");
 // 3) SIN fecha —lo que ahora envía la pantalla— el servidor la DERIVA del hecho: 7 días para rutina, 24 h para urgente.
 const der=await crea({});
 ok(der.dueAt===mas(24*7)&&der.state==="OPEN","ROUTINE_OBLIGATION_DUE_DERIVED_7D");
 ok((await crea({priority:"URGENT"})).dueAt===mas(24),"URGENT_OBLIGATION_DUE_DERIVED_24H");
 // 4) El tipo declarado gana sobre la prioridad pedida: el plazo del resultado crítico no se relaja llamándolo rutina.
 ok((await crea({kind:"CRITICAL_RESULT_REVIEW",priority:"ROUTINE",dueAt:A30})).dueAt===mas(24),"DECLARED_KIND_WINS_OVER_PRIORITY");
 // sin scope
 const noScope=tok(TA,["encounter:read"]);
 r=await obs.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:crypto.randomUUID(),patientId:await freshPatient(TA),ownerId:crypto.randomUUID(),dueAt:"2026-08-15T00:00:00.000Z",kind:"x",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
