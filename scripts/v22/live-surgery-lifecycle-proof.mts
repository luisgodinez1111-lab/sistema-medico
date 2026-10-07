// EPIC AK — Evidencia física del caso quirúrgico (agendar/time-out/iniciar/completar/cancelar) contra Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const{directEndpoint}=await import("../../packages/pg-endpoint/src");
const postgres=(await import("postgres")).default;
const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:2,prepare:false,onnotice:()=>{}});
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const sg=await import("../../apps/web/app/api/v1/surgeries/route");
const to=await import("../../apps/web/app/api/v1/surgeries/[surgeryId]/timeout/route");
const st=await import("../../apps/web/app/api/v1/surgeries/[surgeryId]/start/route");
const co=await import("../../apps/web/app/api/v1/surgeries/[surgeryId]/completion/route");
const cn=await import("../../apps/web/app/api/v1/surgeries/[surgeryId]/cancellation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["PHYSICIAN"],scopes=["surgery:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({surgeryId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const{result,ok,fin}=libro();
async function mk(t:string){const id=crypto.randomUUID();const r=await sg.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({surgeryId:id,patientId:await freshPatient(TA),procedure:"Colecistectomía",laterality:"NA",surgeon:"Dr. X",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
// Auditoría R02b (R2B-018, lote 16): esta prueba hacía `to.POST(...B(phys,1))` —el time-out con el cuerpo VACÍO— y
// comprobaba el 201. Es la prueba que dejaba pasar el hallazgo: un time-out sin un solo ítem del checklist era «correcto».
// Ahora el cuerpo trae los ítems del Time Out de la OMS y la prueba ejercita las barreras: lo confirmado tiene que coincidir
// con lo AGENDADO (procedimiento y lateralidad), ningún ítem puede faltar, y un conteo incorrecto no permite cerrar.
const TIME_OUT_OK={teamIntroduced:true,patientConfirmed:true,procedureConfirmed:"Colecistectomía",lateralityConfirmed:"NA",
 siteMarked:true,antibioticProphylaxis:"GIVEN_WITHIN_60_MIN",criticalEventsReviewed:true,imagingAvailable:true,ledBy:"Enf. Circulante Ruiz"};
const SIGN_OUT_OK={outcome:"Sin complicaciones",procedurePerformed:"Colecistectomía",instrumentCount:"CORRECT",
 spongeCount:"CORRECT",needleCount:"CORRECT",specimensLabelled:true,equipmentIssues:"",recoveryConcernsReviewed:true};
try{
 const phys=tok(TA);
 // agendar -> time-out (con checklist) -> iniciar -> completar (con sign out)
 let{id,r}=await mk(phys);ok(r.status===201&&(await r.json()).state==="SCHEDULED","SCHEDULE_201");
 r=await to.POST(new Request("http://l/",B(phys,1,TIME_OUT_OK)),PP(id));ok(r.status===201&&(await r.json()).state==="TIMED_OUT","TIMEOUT_201");
 r=await st.POST(new Request("http://l/",B(phys,2)),PP(id));ok(r.status===201&&(await r.json()).state==="IN_PROGRESS","START_201");
 r=await co.POST(new Request("http://l/",B(phys,3,SIGN_OUT_OK)),PP(id));ok(r.status===201&&(await r.json()).state==="COMPLETED","COMPLETE_201");
 // LAS BARRERAS DEL CHECKLIST, una por una.
 {
  // 1) El time-out VACÍO —lo que esta misma prueba enviaba antes— ahora se rechaza.
  const t1=await mk(phys);
  r=await to.POST(new Request("http://l/",B(phys,1)),PP(t1.id));
  ok(r.status===400,"EMPTY_TIMEOUT_REJECTED:"+r.status);
  // 2) LATERALIDAD distinta a la agendada: el mecanismo exacto de la cirugía en el lado equivocado.
  const t2=await mk(phys); // agendada con laterality:"NA"
  r=await to.POST(new Request("http://l/",B(phys,1,{...TIME_OUT_OK,lateralityConfirmed:"LEFT"})),PP(t2.id));
  ok(r.status===400&&JSON.stringify(await r.json()).includes("LATERALIDAD_DISTINTA_A_LA_AGENDADA"),"WRONG_SIDE_BLOCKED");
  // 3) PROCEDIMIENTO distinto al agendado.
  const t3=await mk(phys);
  r=await to.POST(new Request("http://l/",B(phys,1,{...TIME_OUT_OK,procedureConfirmed:"Apendicectomía"})),PP(t3.id));
  ok(r.status===400&&JSON.stringify(await r.json()).includes("PROCEDIMIENTO_DISTINTO_AL_AGENDADO"),"WRONG_PROCEDURE_BLOCKED");
  // 4) Un ítem sin confirmar bloquea: sitio no marcado.
  const t4=await mk(phys);
  r=await to.POST(new Request("http://l/",B(phys,1,{...TIME_OUT_OK,siteMarked:false})),PP(t4.id));
  ok(r.status===400&&JSON.stringify(await r.json()).includes("SITIO_NO_MARCADO"),"UNCONFIRMED_ITEM_BLOCKED");
  // 5) Profilaxis antibiótica NO administrada bloquea; declararla no indicada, no.
  const t5=await mk(phys);
  r=await to.POST(new Request("http://l/",B(phys,1,{...TIME_OUT_OK,antibioticProphylaxis:"NOT_GIVEN"})),PP(t5.id));
  ok(r.status===400&&JSON.stringify(await r.json()).includes("PROFILAXIS_ANTIBIOTICA_NO_ADMINISTRADA"),"MISSING_PROPHYLAXIS_BLOCKED");
  r=await to.POST(new Request("http://l/",B(phys,1,{...TIME_OUT_OK,antibioticProphylaxis:"NOT_INDICATED"})),PP(t5.id));
  ok(r.status===201,"PROPHYLAXIS_NOT_INDICATED_IS_VALID:"+r.status);
  // 6) El evento PERSISTIDO cita los ítems y quién dirigió el time-out. Sin esto, «time-out completado» volvería a no
  //    significar nada: es la diferencia entre un registro auditable y un sello de tiempo. No hay ruta GET de una cirugía,
  //    así que se lee el event store directamente —es evidencia física, que es de lo que va esta prueba—.
  const evs=await sql`select payload from clinical_events where tenant_id=${TA} and aggregate_id=${t5.id} and payload->>'kind'='TIMEOUT_COMPLETED' order by sequence desc limit 1`;
  const pay=(evs[0]?.payload??{}) as Record<string,unknown>;
  ok(pay["checklist"]==="WHO_SURGICAL_SAFETY_2009_TIME_OUT","TIMEOUT_EVENT_CITES_CHECKLIST:"+String(pay["checklist"]));
  ok(String(pay["ledBy"]??"").length>0&&pay["siteMarked"]===true&&pay["antibioticProphylaxis"]==="NOT_INDICATED","TIMEOUT_EVENT_CARRIES_ITEMS");
  // 7) CONTEO INCORRECTO al cerrar: no se cierra con un conteo incorrecto (cuerpo extraño retenido).
  const t7=await mk(phys);
  await to.POST(new Request("http://l/",B(phys,1,TIME_OUT_OK)),PP(t7.id));
  await st.POST(new Request("http://l/",B(phys,2)),PP(t7.id));
  r=await co.POST(new Request("http://l/",B(phys,3,{...SIGN_OUT_OK,spongeCount:"INCORRECT"})),PP(t7.id));
  ok(r.status===400&&JSON.stringify(await r.json()).includes("CONTEO_GASAS_INCORRECTO"),"INCORRECT_SPONGE_COUNT_BLOCKS_CLOSURE");
  // Y con el conteo correcto sí cierra: la barrera no es un bloqueo indiscriminado.
  r=await co.POST(new Request("http://l/",B(phys,3,SIGN_OUT_OK)),PP(t7.id));
  ok(r.status===201,"CORRECT_COUNT_CLOSES:"+r.status);
 }
 // SM: iniciar sin time-out (barrera OMS) -> 409
 const two=await mk(phys);
 r=await st.POST(new Request("http://l/",B(phys,1)),PP(two.id));ok(r.status===409,"START_WITHOUT_TIMEOUT_409");
 // SM: completar sin iniciar -> 409
 const three=await mk(phys);
 await to.POST(new Request("http://l/",B(phys,1,TIME_OUT_OK)),PP(three.id));
 r=await co.POST(new Request("http://l/",B(phys,2,SIGN_OUT_OK)),PP(three.id));ok(r.status===409,"COMPLETE_WITHOUT_START_409");
 // cancelar desde TIMED_OUT
 r=await cn.POST(new Request("http://l/",B(phys,2,{reason:"Paciente inestable"})),PP(three.id));ok(r.status===201&&(await r.json()).state==="CANCELLED","CANCEL_FROM_TIMEOUT_201");
 // cross-tenant -> 404
 const physB=tok(TB);
 r=await to.POST(new Request("http://l/",B(physB,1,TIME_OUT_OK)),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope surgery:write -> 403
 const noScope=tok(TA,["PHYSICIAN"],["patient:read"]);
 r=await sg.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({surgeryId:crypto.randomUUID(),patientId:await freshPatient(TA),procedure:"x",laterality:"NA",surgeon:"Y",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
finally{await sql.end();}
fin();
