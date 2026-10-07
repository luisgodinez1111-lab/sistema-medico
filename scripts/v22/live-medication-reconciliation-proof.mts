// Auditoría 2026-09-19, anexo R02a (R02a-MED-02) — CONCILIACIÓN DE MEDICAMENTOS, CONTRA EL SERVIDOR REAL.
//
// EL HALLAZGO, en dos mitades. La primera se cerró hace semanas: MODIFY y RECONCILE exigían la «transición» ACTIVE→ACTIVE
// y devolvían 409 siempre; los eventos de ANOTACIÓN los hicieron posibles. La segunda sobrevivió hasta hoy:
// `handleMedicationReconciliation` **no tenía ruta**. Estaba completo —esquema, barreras, `commitAnnotation`— y ninguna
// ruta lo exponía, así que ni un médico ni una prueba podían alcanzarlo. La cabecera de
// `live-medication-annotations-proof.mts` decía «MODIFY/RECONCILE» pero la prueba solo ejercía MODIFY: evidencia que
// apunta a código que nunca corre, el patrón que esta campaña persigue desde el primer día.
//
// Y al cablearlo apareció un defecto de MODELO: el cuerpo pedía `status: ADMITTED|DISCHARGED|TRANSFERRED|UNCHANGED`, que
// es CUÁNDO se concilió, no QUÉ se concilió. Conciliar es comparar lo prescrito con lo que el paciente realmente toma;
// el registro necesita el resultado, la FUENTE contra la que se comprobó y el punto del trayecto.
//
// Esta prueba mide las tres cosas que hacen de esto un control y no un adorno: que la conciliación se guarda y se LEE,
// que una discrepancia sin explicación se RECHAZA, y que el fold no inventa un resultado cuando el vocabulario no cuadra.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{foldMedication}=await import("../../packages/medication-fold/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const medR=await import("../../apps/web/app/api/v1/medications/route");
const presR=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const actR=await import("../../apps/web/app/api/v1/medications/[medicationId]/activation/route");
const recR=await import("../../apps/web/app/api/v1/medications/[medicationId]/reconciliation/route");
const stopR=await import("../../apps/web/app/api/v1/medications/[medicationId]/discontinuation/route");
const chartR=await import("../../apps/web/app/api/v1/patients/[patientId]/chart/route");
const resR=await import("../../apps/web/app/api/v1/results/route");

const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const tok=(scopes=["patient:write","patient:read","medication:propose","medication:write","result:write"])=>signSession(
 {sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
const H=(t:string,x:Record<string,string>={})=>({"content-type":"application/json",authorization:"Bearer "+t,...x});
const idem=()=>crypto.randomUUID();
let ts=Date.parse("2026-10-02T15:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
const ok=(c:boolean,l:string)=>{if(!c)throw new Error("FAIL:"+l);result.checks.push(l);};
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});
const post=async(r:{POST:(q:Request,c?:never)=>Promise<Response>},body:unknown,t:string,extra:Record<string,string>={},ctx?:unknown)=>{
 const res=await (r.POST as (q:Request,c?:unknown)=>Promise<Response>)(
  new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),...extra}),body:JSON.stringify(body)}),ctx);
 return{status:res.status,body:await res.json() as Record<string,unknown>};
};

try{
 const phys=tok();await registerPhysicianCredentials(phys);
 const p=crypto.randomUUID();
 await post(patR,{patientId:p,name:"Prueba Conciliación",birthDate:"1962-02-02",sexAtBirth:"MALE",occurredAt:at()},phys);
 // Creatinina para que la barrera renal pueda EVALUAR: sin ella la prescripción se detiene en 428 pidiendo
 // reconocimiento de verificación incompleta, que es el comportamiento correcto y no lo que esta prueba mide.
 await post(resR,{resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:"CREATININE",value:"0.9",unit:"mg/dL",occurredAt:at()},phys);

 // Un fármaco EN CURSO: conciliar solo procede sobre ACTIVE/HELD (una propuesta se corrige cancelándola).
 const med=crypto.randomUUID();
 const prop=await post(medR,{medicationId:med,patientId:p,drugCode:"metformina",dose:"850 mg",route:"oral",frequency:"c/12h",occurredAt:at()},phys);
 ok(prop.status===201,`PROPUESTA_${prop.status}`);
 const pres=await post(presR,{occurredAt:at()},phys,{"if-match":"1"},MP(med));
 ok(pres.status===201,`PRESCRITA_${pres.status}:${JSON.stringify(pres.body).slice(0,140)}`);
 const act=await post(actR,{occurredAt:at()},phys,{"if-match":"2"},MP(med));
 ok(act.status===201,`ACTIVADA_${act.status}`);

 // ───────── LA RUTA QUE NO EXISTÍA ─────────
 const rec=await post(recR,{outcome:"CONTINUED",verifiedAgainst:"PATIENT",context:"OUTPATIENT_VISIT",occurredAt:at()},phys,{"if-match":"3"},MP(med));
 ok(rec.status===201,`LA_RUTA_EXISTE_Y_RESPONDE_${rec.status}:${JSON.stringify(rec.body).slice(0,160)}`);
 // Es una ANOTACIÓN: el fármaco sigue ACTIVE. Conciliar no es una transición de ciclo de vida.
 ok(rec.body["state"]==="ACTIVE",`CONCILIAR_NO_CAMBIA_EL_ESTADO:${String(rec.body["state"])}`);

 // ───────── SE LEE: antes el fold la descartaba con un `continue` sin leer un campo ─────────
 const{readAggregateEvents}=await import("../../apps/web/lib/clinical-runtime");
 const rctx={tenantId:TA,actorId:crypto.randomUUID(),actorType:"PHYSICIAN" as const,purpose:"TREATMENT",
  requestId:crypto.randomUUID(),sessionId:crypto.randomUUID()};
 const f1=foldMedication(await readAggregateEvents(rctx,med));
 ok(f1.reconciliation!==null,"EL_FOLD_LEE_LA_CONCILIACION");
 ok(f1.reconciliation?.outcome==="CONTINUED",`EL_RESULTADO_VUELVE:${String(f1.reconciliation?.outcome)}`);
 ok(f1.reconciliation?.verifiedAgainst==="PATIENT",`LA_FUENTE_VUELVE:${String(f1.reconciliation?.verifiedAgainst)}`);
 ok(f1.reconciliation?.context==="OUTPATIENT_VISIT",`EL_CONTEXTO_VUELVE:${String(f1.reconciliation?.context)}`);
 ok(f1.reconciliationDiscrepancy===false,"SIN_DISCREPANCIA_CUANDO_LO_SIGUE_TOMANDO");
 ok(f1.state==="ACTIVE","EL_FARMACO_SIGUE_ACTIVO_TRAS_CONCILIAR");

 // ───────── LA DISCREPANCIA, que es el hallazgo entero del acto ─────────
 // Sin explicación se RECHAZA: «no lo está tomando» sin motivo no permite decidir nada.
 const sinMotivo=await post(recR,{outcome:"NOT_TAKING",verifiedAgainst:"PATIENT",context:"OUTPATIENT_VISIT",occurredAt:at()},phys,{"if-match":"4"},MP(med));
 ok(sinMotivo.status===400,`DISCREPANCIA_SIN_MOTIVO_ES_400_${sinMotivo.status}`);
 const conMotivo=await post(recR,{outcome:"NOT_TAKING",verifiedAgainst:"CAREGIVER",context:"OUTPATIENT_VISIT",
  note:"lo dejó hace tres semanas por diarrea; no lo comentó",occurredAt:at()},phys,{"if-match":"4"},MP(med));
 ok(conMotivo.status===201,`DISCREPANCIA_CON_MOTIVO_${conMotivo.status}:${JSON.stringify(conMotivo.body).slice(0,140)}`);
 const f2=foldMedication(await readAggregateEvents(rctx,med));
 ok(f2.reconciliationDiscrepancy===true,"LA_DISCREPANCIA_SE_MARCA");
 ok(f2.reconciliation?.outcome==="NOT_TAKING","GANA_LA_ULTIMA_CONCILIACION");
 ok(String(f2.reconciliation?.note??"").includes("diarrea"),"EL_MOTIVO_DE_LA_DISCREPANCIA_SE_GUARDA");
 ok(f2.state==="ACTIVE","UNA_DISCREPANCIA_NO_SUSPENDE_EL_FARMACO");

 // ───────── EN EL EXPEDIENTE, que es donde el médico la ve ─────────
 const chart=await (chartR.GET as (q:Request,c:unknown)=>Promise<Response>)(new Request("http://l/",{headers:H(phys)}),{params:Promise.resolve({patientId:p})});
 const cb=await chart.json() as{medications:Array<{id:string;reconOutcome?:string;reconSource?:string;reconAt?:string}>};
 const fila=cb.medications.find(x=>x.id===med);
 ok(fila?.reconOutcome==="NOT_TAKING",`EL_EXPEDIENTE_MUESTRA_LA_DISCREPANCIA:${String(fila?.reconOutcome)}`);
 ok(fila?.reconSource==="CAREGIVER",`EL_EXPEDIENTE_MUESTRA_LA_FUENTE:${String(fila?.reconSource)}`);
 ok(typeof fila?.reconAt==="string"&&!Number.isNaN(Date.parse(fila.reconAt)),"EL_EXPEDIENTE_MUESTRA_CUANDO_SE_CONCILIO");

 // ───────── LO QUE NO SE PUEDE CONCILIAR ─────────
 // Un vocabulario que el servidor no conoce se rechaza: no se guarda un resultado que el fold tendría que adivinar.
 const malVocab=await post(recR,{outcome:"ADMITTED",verifiedAgainst:"PATIENT",context:"OUTPATIENT_VISIT",occurredAt:at()},phys,{"if-match":"5"},MP(med));
 ok(malVocab.status===400,`VOCABULARIO_VIEJO_ES_400_${malVocab.status}`);
 const sinFuente=await post(recR,{outcome:"CONTINUED",context:"OUTPATIENT_VISIT",occurredAt:at()},phys,{"if-match":"5"},MP(med));
 ok(sinFuente.status===400,`SIN_FUENTE_ES_400_${sinFuente.status}`);
 // Un fármaco SUSPENDIDO ya no se concilia: lo que se concilia es lo que el paciente podría estar tomando.
 const stop=await post(stopR,{reason:"suspendido por la discrepancia encontrada",occurredAt:at()},phys,{"if-match":"5"},MP(med));
 ok(stop.status===201,`SUSPENDIDA_${stop.status}`);
 const trasSuspender=await post(recR,{outcome:"CONTINUED",verifiedAgainst:"PATIENT",context:"OUTPATIENT_VISIT",occurredAt:at()},phys,{"if-match":"6"},MP(med));
 ok(trasSuspender.status===409,`CONCILIAR_UNA_SUSPENDIDA_ES_409_${trasSuspender.status}`);

 // Aislamiento: otro consultorio no puede conciliar este fármaco.
 const otro=signSession({sub:crypto.randomUUID(),tenantId:crypto.randomUUID(),roles:["PHYSICIAN"],
  scopes:["medication:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
 const cross=await post(recR,{outcome:"CONTINUED",verifiedAgainst:"PATIENT",context:"OUTPATIENT_VISIT",occurredAt:at()},otro,{"if-match":"6"},MP(med));
 ok(cross.status===404,`CROSS_TENANT_404_${cross.status}`);
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
