// Auditoría 2026-09-19 (C-02) — PRUEBA EN VIVO contra PostgreSQL real: corrección de un resultado de laboratorio.
//   · un potasio 7.0 (crítico) se corrige a 4.2 con razón: el original queda CORRECTED (supersededBy), el corregido es
//     un resultado NUEVO con `supersedes` e interpretación propia (NORMAL, no crítico);
//   · las calculadoras y la serie leen solo el vigente (4.2); el gate de firma deja de contar el crítico corregido y la
//     obligación urgente derivada (C-20) se completa con la razón; el reintento idempotente no duplica;
//   · un resultado ya corregido no se corrige otra vez (409); sin razón -> 400.
//   · AUDITORÍA M4: la corrección escribe sus DOS hechos (resultado corregido + anotación del original) en UNA transacción
//     atómica (comando multi-agregado): si un leg falla el chequeo optimista, la transacción entera revierte y no queda
//     estado parcial —se prueba forzando un conflicto en el segundo leg y comprobando que el primero NO se escribió.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts");
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{resolveVerified}=await import("../../apps/web/lib/http-command");
const{readAggregateEvents,latestAnalyteReading,analyteSeries,countOpenCriticalResults,readTenantOpenAggregates}=await import("../../apps/web/lib/clinical-runtime");
const{criticalObligationId}=await import("../../apps/web/lib/result-lifecycle");
const{foldResult}=await import("../../packages/result-fold/src");
const{foldObligation}=await import("../../packages/obligation-fold/src");
const results=await import("../../apps/web/app/api/v1/results/route");
const correction=await import("../../apps/web/app/api/v1/results/[resultId]/correction/route");
const errorMark=await import("../../apps/web/app/api/v1/results/[resultId]/error-mark/route");
const{resultsRegistry,resultsSummary}=await import("../../apps/web/lib/clinical-runtime");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const phys=signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes:["result:write","result:read","patient:read"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
const H=(x:Record<string,string>={})=>({"content-type":"application/json",authorization:"Bearer "+phys,...x});
const idem=()=>crypto.randomUUID();const RP=(id:string)=>({params:Promise.resolve({resultId:id})});
let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60000).toISOString();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const pat=crypto.randomUUID();await ensurePatientIn(TA,pat);const ctx=resolveVerified(new Request("http://l/",{headers:H()})).ctx;
 const r1=crypto.randomUUID();
 let r:Response=await results.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem()}),body:JSON.stringify({resultId:r1,patientId:pat,orderId:crypto.randomUUID(),analyte:"POTASSIUM",value:"7.0",unit:"mEq/L",occurredAt:at()})}));
 ok(r.status===201&&(await r.json()).critical===true,"CRITICAL_RECEIVED");
 ok(await countOpenCriticalResults(ctx,pat)===1,"CRITICAL_COUNTS_BEFORE_CORRECTION");
 // sin razón -> 400
 const r2=crypto.randomUUID();
 r=await correction.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({correctedResultId:r2,value:"4.2",unit:"mEq/L",occurredAt:at()})}),RP(r1));ok(r.status===400,"CORRECTION_WITHOUT_REASON_400");
 // corrección válida (mismo Idempotency-Key dos veces)
 const key=idem();const when=at();
 const body=JSON.stringify({correctedResultId:r2,value:"4.2",unit:"mEq/L",reason:"Muestra hemolizada; nueva extracción",occurredAt:when});
 r=await correction.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":key,"if-match":"1"}),body}),RP(r1));
 const j=await r.json() as{supersededBy:string;corrected:{resultId:string;critical:boolean;status:string}};
 ok(r.status===201&&j.supersededBy===r2&&j.corrected.critical===false&&j.corrected.status==="NORMAL","CORRECTED_201_NEW_RESULT_NORMAL");
 const orig=foldResult(await readAggregateEvents(ctx,r1));const nuevo=foldResult(await readAggregateEvents(ctx,r2));
 ok(orig.supersededBy===r2&&orig.state==="RECEIVED"&&nuevo.supersedes===r1&&nuevo.critical===false,"FOLDS_LINKED_BOTH_WAYS");
 ok((await latestAnalyteReading(ctx,pat,"POTASSIUM"))?.value===4.2,"CALCULATORS_READ_CORRECTED_VALUE");
 ok((await analyteSeries(ctx,pat,"POTASSIUM")).map(p=>p.value).join()==="4.2","SERIES_EXCLUDES_SUPERSEDED");
 ok(await countOpenCriticalResults(ctx,pat)===0,"SIGN_GATE_NO_LONGER_COUNTS_CORRECTED_CRITICAL");
 // Coherencia de lectores (auditoría Lote 1): el registro poblacional "Toda la clínica" y su KPI tampoco resucitan el
 // original corregido — antes solo excluían ENTERED_IN_ERROR, así que el K 7.0 crítico reaparecía vigente y duplicado.
 const regItems=(await resultsRegistry(ctx)).items;
 ok(!regItems.some(x=>x.resultId===r1)&&regItems.some(x=>x.resultId===r2&&x.critical===false),"CORRECTED_ORIGINAL_NOT_IN_REGISTRY");
 const summ=await resultsSummary(ctx);
 ok(summ.total===1&&summ.abnormal===0,"CORRECTED_NOT_COUNTED_IN_SUMMARY");
 // El worklist poblacional (readTenantOpenAggregates) tampoco debe listar el resultado corregido como agregado "abierto"
 // (si además estuvo ACTIONED, generaría un gap crítico fantasma); el corregido vigente (r2) sí es una fila legítima.
 const openAggs=(await readTenantOpenAggregates(ctx)).rows; // R04-008: el lector devuelve {rows,truncated}
 ok(!openAggs.some(x=>x.aggregateId===r1)&&openAggs.some(x=>x.aggregateId===r2),"CORRECTED_ORIGINAL_NOT_IN_WORKLIST_AGGREGATES");
 ok(foldObligation(await readAggregateEvents(ctx,criticalObligationId(r1))).state==="COMPLETED","DERIVED_OBLIGATION_COMPLETED_WITH_REASON");
 // reintento idempotente -> 200 replayed, sin eventos nuevos
 r=await correction.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":key,"if-match":"1"}),body}),RP(r1));
 ok(r.status===200&&(await r.json()).replayed===true&&(await readAggregateEvents(ctx,r1)).length===2&&(await readAggregateEvents(ctx,r2)).length===1,"IDEMPOTENT_RETRY_NO_DUPLICATES");
 // segunda corrección del mismo original -> 409
 r=await correction.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({correctedResultId:crypto.randomUUID(),value:"4.0",unit:"mEq/L",reason:"Otra corrección",occurredAt:at()})}),RP(r1));
 ok(r.status===409,"ALREADY_SUPERSEDED_409");

 // ---- AUDITORÍA M4: ATOMICIDAD del comando multi-agregado. La corrección escribe DOS hechos en una transacción (resultado
 // corregido + anotación del original). Se prueba el primitivo directamente: dos legs donde el SEGUNDO lleva una versión
 // obsoleta (conflicto optimista); la transacción ENTERA revierte y el PRIMER leg —un RESULT_RECEIVED por lo demás válido—
 // NO queda escrito. Antes, con dos comandos independientes, el primero ya estaba persistido cuando fallaba el segundo. ----
 {
  const{executeAtomicMultiCommand}=await import("../../packages/atomic-clinical-transaction-v3/src");
  const{buildMultiCommand}=await import("../../apps/web/lib/http-command");
  const{getSql}=await import("../../apps/web/lib/clinical-runtime");
  const good=crypto.randomUUID();
  const multi=buildMultiCommand({idempotencyKey:idem(),occurredAt:at(),legs:[
   {aggregateType:"DiagnosticResult",aggregateId:good,expectedVersion:0,eventType:"RESULT_RECEIVED",payload:{kind:"RECEIVED",patientId:pat,orderId:crypto.randomUUID(),analyte:"SODIUM",value:"140",status:"NORMAL",critical:false,interpretation:"x"},topic:"result.received"},
   {aggregateType:"DiagnosticResult",aggregateId:crypto.randomUUID(),expectedVersion:9,eventType:"RESULT_CORRECTED",payload:{kind:"CORRECTED",supersededBy:good,reason:"forzar conflicto optimista en el segundo leg"},topic:"result.corrected"},
  ]});
  let threw=false;try{await executeAtomicMultiCommand(getSql(),ctx,multi);}catch{threw=true;}
  ok(threw,"MULTI_SECOND_LEG_CONFLICT_THROWS");
  ok((await readAggregateEvents(ctx,good)).length===0,"MULTI_ATOMIC_ROLLBACK_FIRST_LEG_NOT_WRITTEN");
 }

 // ---- R03-10: ANULACIÓN PURA. Antes solo existía la corrección, que exige un valor nuevo: un resultado capturado en el
 // paciente equivocado no se podía retirar del expediente, solo "corregir" con otro número. ----
 const pat2=crypto.randomUUID();await ensurePatientIn(TA,pat2);
 const r3=crypto.randomUUID();
 r=await results.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem()}),body:JSON.stringify({resultId:r3,patientId:pat2,orderId:crypto.randomUUID(),analyte:"POTASSIUM",value:"7.2",unit:"mEq/L",occurredAt:at()})}));
 ok(r.status===201&&(await r.json()).critical===true,"VOID_CRITICAL_RECEIVED");
 ok((await latestAnalyteReading(ctx,pat2,"POTASSIUM"))?.value===7.2,"VOID_READ_BEFORE");
 ok(await countOpenCriticalResults(ctx,pat2)===1,"VOID_CRITICAL_BLOCKS_BEFORE");
 // el motivo tiene que explicar algo: «x» no basta
 r=await errorMark.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"x",occurredAt:at()})}),RP(r3));
 ok(r.status===400,"VOID_REASON_REQUIRED_400");
 const vkey=idem();const vbody=JSON.stringify({reason:"Muestra etiquetada con el paciente equivocado",occurredAt:at()});
 r=await errorMark.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":vkey,"if-match":"1"}),body:vbody}),RP(r3));
 ok(r.status===201&&(await r.json()).enteredInError===true,"VOID_201");
 const anulado=foldResult(await readAggregateEvents(ctx,r3));
 ok(anulado.enteredInError===true&&anulado.state==="RECEIVED","VOID_IS_ANNOTATION_NOT_STATE");
 // el dato deja de existir para TODOS los lectores, pero el evento sigue en la cadena
 ok((await latestAnalyteReading(ctx,pat2,"POTASSIUM"))===undefined,"VOIDED_NOT_READ_BY_CALCULATORS");
 ok((await analyteSeries(ctx,pat2,"POTASSIUM")).length===0,"VOIDED_NOT_IN_SERIES");
 ok(await countOpenCriticalResults(ctx,pat2)===0,"VOIDED_CRITICAL_NO_LONGER_BLOCKS");
 // R06-20: el registro devuelve una página (items + cursor + total) en lugar de todas las filas del tenant.
 ok(!(await resultsRegistry(ctx)).items.some(x=>x.resultId===r3),"VOIDED_NOT_IN_REGISTRY");
 ok(!(await readTenantOpenAggregates(ctx)).rows.some(x=>x.aggregateId===r3),"VOIDED_NOT_IN_WORKLIST_AGGREGATES");
 ok((await readAggregateEvents(ctx,r3)).length===2,"VOID_EVENT_PERSISTS_IN_CHAIN");
 ok(foldObligation(await readAggregateEvents(ctx,criticalObligationId(r3))).state==="COMPLETED","VOID_COMPLETES_DERIVED_OBLIGATION");
 // reintento idempotente y segunda anulación
 r=await errorMark.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":vkey,"if-match":"1"}),body:vbody}),RP(r3));
 ok(r.status===200&&(await r.json()).replayed===true&&(await readAggregateEvents(ctx,r3)).length===2,"VOID_IDEMPOTENT_RETRY");
 r=await errorMark.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({reason:"Otra vez, por si acaso",occurredAt:at()})}),RP(r3));
 ok(r.status===409,"ALREADY_VOIDED_409");
 // un resultado anulado tampoco se corrige: se registra uno nuevo
 r=await correction.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({correctedResultId:crypto.randomUUID(),value:"4.0",unit:"mEq/L",reason:"No procede",occurredAt:at()})}),RP(r3));
 ok(r.status===409,"VOIDED_CANNOT_BE_CORRECTED_409");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
