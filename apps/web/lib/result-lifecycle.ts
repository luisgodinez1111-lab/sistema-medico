import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldResult,assertResultTransition,assertResultCorrectable,type FoldedResult}from"../../../packages/result-fold/src";
import{type ResultState}from"../../../packages/order-result-domain/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,latestResultValueForAnalyte,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson,replayStablePayload,derivedUuid}from"./http-command";
import{foldObligation}from"../../../packages/obligation-fold/src";
import{classifyLab,normalizeLabValue,deltaCheck}from"../../../packages/lab-reference/src";
import{foldOrder}from"../../../packages/order-fold/src";
// EPIC G — Ciclo de vida del resultado diagnóstico (closed-loop de seguimiento) sobre el kernel.
// EPIC AQ (profundidad): si se envía analito+valor, el flag `critical` se DERIVA del valor (valores de pánico).
// RECEIVED -> VERIFIED -> ACTIONED (obligación) -> CLOSED. Un resultado CRÍTICO en ACTIONED sin
// cerrar bloquea la firma del encuentro del paciente (Zero Lost Follow-Up, ver encounter-lifecycle).
const AGG="DiagnosticResult";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{role:"PHYSICIAN",scope:"result:write",purpose:"TREATMENT"});
}

// Auditoría R02a-RES-01: `unit` era OPCIONAL en la API. Sin unidad, el valor se asumía en la unidad canónica y quedaba
// marcado `unitAssumed:true` — es decir, la decisión más peligrosa del laboratorio (¿7 mmol/L o 7 mg/dL de glucosa?) se
// tomaba por omisión. La UI ya la exigía; la API no, y la API es la que reciben las integraciones de laboratorio. Ahora es
// OBLIGATORIA al RECIBIR y al CORREGIR: sin unidad se responde 400 y el valor no entra al expediente. `specimenId` sigue
// opcional (no todo resultado nace de una muestra registrada) y `unitAssumed` se conserva en el fold para los resultados
// históricos que se registraron sin ella.
export const ReceiveBody=z.object({resultId:z.string().uuid(),patientId:z.string().uuid(),orderId:z.string().uuid(),analyte:z.string().min(1).max(60),value:z.string().min(1).max(60),unit:z.string().trim().min(1,"La unidad es obligatoria: sin ella el valor no se puede interpretar").max(24),specimenId:z.string().uuid().optional(),occurredAt:z.string().datetime()});
// RECEIVE = creación del agregado (expectedVersion 0). Idempotencia la maneja el kernel.
// EPIC AQ: si se envía analyte+value, el flag `critical` se DERIVA del valor real
// (valores de pánico), no se confía en el booleano del cliente.
export async function handleResultReceived(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ReceiveBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  // Auditoría R02a-ORD-01: `orderId` se persistía sin comprobar nada. Un resultado podía declararse contra una orden
  // INEXISTENTE o, peor, contra la orden de OTRO paciente, y el expediente quedaba con una trazabilidad falsa
  // («este resultado responde a esta orden») que nadie podía detectar después. Se valida el vínculo: si la orden existe
  // en el tenant, tiene que ser del mismo paciente. Se admite un `orderId` sin orden registrada porque hay resultados
  // legítimos sin orden previa en el sistema (traía el paciente un laboratorio externo), pero entonces queda marcado.
  const ordenVinculada=foldOrder(await readAggregateEvents(ctx,b.orderId));
  if(ordenVinculada.exists&&ordenVinculada.patientId!==b.patientId)
   throw new ClinicalError("CONFLICT","La orden declarada es de otro paciente",{conflictReason:"ORDER_PATIENT_MISMATCH"});
  const payload=await interpretForReceive(ctx,b);
  // El Δ vs previo depende de los demás resultados del paciente: estable ante reintentos (ver replayStablePayload).
  const stable=await replayStablePayload(ctx,idempotencyKey,b.resultId,b,()=>payload);
  return await commitReceived(ctx,idempotencyKey,b,stable);
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
type ReceiveInput=Readonly<{resultId:string;patientId:string;orderId:string;analyte:string;value:string;unit?:string|undefined;specimenId?:string|undefined;occurredAt:string}>;
// Interpretación de un resultado recibido (unidad, plausibilidad, crítico, Δ vs previo). Compartida por RECEIVE y CORRECTION.
// `priorExclude`: resultado que NO cuenta como "valor previo" del Δ (el propio; en una corrección, el original que se reemplaza).
async function interpretForReceive(ctx:Parameters<typeof runClinicalCommand>[0],b:ReceiveInput,extra:Record<string,unknown>={},priorExclude:string=b.resultId):Promise<Record<string,unknown>>{
  // Auditoría C-01/C-12/U-07: unidad + plausibilidad ANTES de persistir. Un valor en unidad no reconocida o físicamente
  // implausible (p. ej. plaquetas 250000 sin unidad, glucosa 7 "mg/dL") se RECHAZA con un mensaje accionable, en vez de
  // guardarse y producir después un falso crítico o un score absurdo. Los resultados cualitativos (no numéricos) pasan.
  const norm=normalizeLabValue(b.analyte,b.value,b.unit);
  if(!norm.ok&&norm.reason!=="NOT_NUMERIC")throw new ClinicalError("VALIDATION_ERROR",norm.message,{analyte:b.analyte,reason:norm.reason});
  // Derivar critical del valor real (ya en unidad canónica) usando catálogo de rangos de laboratorio
  const assessment=classifyLab(b.analyte,b.value,b.unit);
  // EPIC BB (profundidad): delta check longitudinal — comparar con el valor previo del mismo analito.
  // Una variación crítica (p. ej. creatinina que se duplica, Hb -2 g/dL) ELEVA el resultado a `critical`
  // aunque el valor absoluto no sea de pánico -> participa del gate de firma (Zero Lost Follow-Up).
  const prior=await latestResultValueForAnalyte(ctx,b.patientId,b.analyte,priorExclude);
  const current=norm.ok?String(norm.canonicalValue):b.value;
  const delta=prior!==undefined?deltaCheck(b.analyte,prior,current):{flagged:false,severity:"NONE" as const,changeAbs:0,changePct:0,note:""};
  const critical=assessment.critical||delta.flagged;
  const interpretation=delta.flagged?`${assessment.interpretation} · Δ crítico vs previo (${prior}→${b.value}): ${delta.note}`:assessment.interpretation;
  const payload:Record<string,unknown>={kind:"RECEIVED",patientId:b.patientId,orderId:b.orderId,orderLinked:foldOrder(await readAggregateEvents(ctx,b.orderId)).exists,critical,status:delta.flagged?"CRITICAL":assessment.status,interpretation,analyte:b.analyte,value:b.value};
  if(norm.ok){payload["unit"]=b.unit?.trim()||null;payload["canonicalValue"]=norm.canonicalValue;payload["canonicalUnit"]=norm.canonicalUnit;payload["unitAssumed"]=norm.unitAssumed;}
  if(b.specimenId)payload["specimenId"]=b.specimenId;
  if(delta.flagged){payload["deltaFlagged"]=true;payload["deltaSeverity"]=delta.severity;payload["deltaChangeAbs"]=delta.changeAbs;payload["deltaChangePct"]=delta.changePct;payload["priorValue"]=prior;}
  return{...payload,...extra};
}
async function commitReceived(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,b:ReceiveInput,stable:Record<string,unknown>):Promise<Response>{
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.resultId,expectedVersion:0,eventType:"RESULT_RECEIVED",payload:stable,occurredAt:b.occurredAt,topic:"result.received"});
  const result=await runClinicalCommand(ctx,cmd);
  // Auditoría C-20: un resultado CRÍTICO crea además una obligación con RESPONSABLE (quien lo recibió: es quien debe
  // localizar al paciente o derivarlo) y FECHA (24 h, URGENTE). Identificadores derivados del resultId: el reintento no
  // duplica y el cierre del resultado la completa (ver handleResultClosure).
  if(stable["critical"]===true&&!result.replayed)await createCriticalResultObligation(ctx,b.resultId,b.patientId,ctx.actorId,String(stable["analyte"]??b.analyte??""),b.occurredAt);
  const r=result.response as{version:number;auditHash?:string};
  // La respuesta dice la VERDAD de la interpretación: NORMAL / ABNORMAL / CRITICAL / UNKNOWN (antes solo `critical`, y la UI
  // anunciaba "dentro de rango" para todo lo no crítico, incluidos valores anormales y analitos sin rango tabulado).
  // Se responde con lo PERSISTIDO (`stable`): en un reintento es la interpretación original, no una recalculada.
  return NextResponse.json({resultId:b.resultId,state:"RECEIVED",critical:stable["critical"]===true,status:stable["status"],interpretation:stable["interpretation"],deltaFlagged:stable["deltaFlagged"]===true,
   ...(stable["canonicalValue"]!==undefined?{canonicalValue:stable["canonicalValue"],canonicalUnit:stable["canonicalUnit"],unitAssumed:stable["unitAssumed"]}:{}),
   version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}
// Auditoría 2026-09-19 (C-02) — CORRECCIÓN de un resultado: el laboratorio emite un valor corregido. Nunca se edita el
// original: se recibe un resultado NUEVO (`supersedes: original`, con la misma interpretación completa: unidad, crítico, Δ)
// y el original queda anotado CORRECTED (`supersededBy`). Calculadoras, series y el gate de firma leen solo el vigente;
// la obligación urgente derivada del original (C-20) se completa con la razón de la corrección. Exige razón.
export const CorrectionBody=z.object({correctedResultId:z.string().uuid(),value:z.string().min(1).max(60),unit:z.string().trim().min(1,"La unidad es obligatoria: sin ella el valor no se puede interpretar").max(24),reason:z.string().min(5).max(500),occurredAt:z.string().datetime()});
export async function handleResultCorrection(req:Request,resultId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,resultId);
  const b=await parseJson(req,CorrectionBody);
  // Reintento idempotente: la anotación ya persistida responde igual (antes de cualquier precondición, como en el resto de handlers).
  const annotation=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:resultId,expectedVersion,eventType:"RESULT_CORRECTED",payload:{kind:"CORRECTED",supersededBy:b.correctedResultId,reason:b.reason},occurredAt:b.occurredAt,topic:"result.corrected"});
  const replayed=await lookupReplay(ctx,annotation);
  if(replayed){const r=replayed.response as{version:number;auditHash?:string};return NextResponse.json({resultId,state:folded.state,supersededBy:b.correctedResultId,version:r.version,auditHash:r.auditHash,replayed:true},{status:200});}
  if(expectedVersion!==folded.version)throw new ClinicalError("CONCURRENCY_CONFLICT","Result changed since last read",{expected:expectedVersion,actual:folded.version});
  assertResultCorrectable(folded);
  const original=(await readAggregateEvents(ctx,resultId)).find(e=>e.payload["kind"]==="RECEIVED")?.payload??{};
  const analyte=String(original["analyte"]??"");if(!analyte)throw new ClinicalError("CONFLICT","El resultado original no tiene analito: no se puede corregir");
  const input:ReceiveInput={resultId:b.correctedResultId,patientId:folded.patientId,orderId:String(original["orderId"]??resultId),analyte,value:b.value,...(b.unit!==undefined?{unit:b.unit}:{}),...(typeof original["specimenId"]==="string"?{specimenId:String(original["specimenId"])}:{}),occurredAt:b.occurredAt};
  // 1) el resultado corregido, con `supersedes`: es lo que leen las calculadoras aunque la anotación (2) fallara.
  const payload=await interpretForReceive(ctx,input,{supersedes:resultId,correctionReason:b.reason},resultId); // el Δ no se mide contra el valor que se corrige
  const stable=await replayStablePayload(ctx,derivedUuid(idempotencyKey,"corrected-result"),b.correctedResultId,b,()=>payload);
  const created=await commitReceived(ctx,derivedUuid(idempotencyKey,"corrected-result"),input,stable);
  if(created.status>=400)return created;
  // 2) anotación en el original + cierre de su obligación derivada (si la había).
  const result=await runClinicalCommand(ctx,annotation);
  await completeCriticalResultObligation(ctx,resultId,`resultado corregido (${b.reason})`,b.occurredAt);
  const r=result.response as{version:number;auditHash?:string};
  const c=await created.json() as Record<string,unknown>;
  return NextResponse.json({resultId,state:folded.state,supersededBy:b.correctedResultId,corrected:{resultId:b.correctedResultId,critical:c["critical"],status:c["status"],interpretation:c["interpretation"]},version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,resultId:string){
 const{claims,ctx}=resolveVerified(req);
 authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldResult(await readAggregateEvents(ctx,resultId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Result not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commitTransition(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,resultId:string,folded:FoldedResult,to:ResultState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:resultId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertResultTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({resultId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

export const VerifyBody=z.object({occurredAt:z.string().datetime()});
export async function handleResultVerification(req:Request,resultId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,resultId);
  const b=await parseJson(req,VerifyBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,resultId,folded,"VERIFIED","RESULT_VERIFIED",{kind:"VERIFIED"},b.occurredAt,"result.verified");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// ACTION = requerir acción (crea la obligación). Un resultado crítico exige owner + due date.
export const ActionBody=z.object({ownerId:z.string().uuid(),dueAt:z.string().datetime(),occurredAt:z.string().datetime()});
export async function handleResultAction(req:Request,resultId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,resultId);
  const b=await parseJson(req,ActionBody);
  // payload lleva patientId + critical para que el gate de firma pueda contar sin proyección.
  return await commitTransition(ctx,idempotencyKey,expectedVersion,resultId,folded,"ACTIONED","RESULT_ACTION_REQUIRED",{kind:"ACTIONED",patientId:folded.patientId,critical:folded.critical,ownerId:b.ownerId,dueAt:b.dueAt},b.occurredAt,"result.action_required");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// CLOSURE = cierre con evidencia (resuelve la obligación -> desbloquea la firma).
export const CloseBody=z.object({evidence:z.string().min(1),occurredAt:z.string().datetime()});
export const CRITICAL_RESULT_DUE_HOURS=24;
export const criticalObligationId=(resultId:string)=>derivedUuid(resultId,"critical-result-obligation");
async function createCriticalResultObligation(ctx:Parameters<typeof runClinicalCommand>[0],resultId:string,patientId:string,ownerId:string,analyte:string,occurredAt:string):Promise<void>{
 const obligationId=criticalObligationId(resultId);
 const dueAt=new Date(Date.parse(occurredAt)+CRITICAL_RESULT_DUE_HOURS*3600000).toISOString();
 const cmd=buildCommand({idempotencyKey:derivedUuid(resultId,"critical-result-obligation-idem"),aggregateType:"ClinicalObligation",aggregateId:obligationId,expectedVersion:0,eventType:"OBLIGATION_CREATED",
  payload:{kind:"CREATED",patientId,ownerId,dueAt,obligationKind:"CRITICAL_RESULT_REVIEW",priority:"URGENT",sourceResultId:resultId,test:analyte,note:`Resultado crítico de ${analyte}: contactar al paciente, actuar y cerrar el resultado con evidencia`},occurredAt,topic:"obligation.created"});
 let r=await lookupReplay(ctx,cmd);if(!r)r=await runClinicalCommand(ctx,cmd);
}
// Al CERRAR un resultado crítico con evidencia, la obligación derivada se completa con esa misma evidencia (si sigue abierta).
async function completeCriticalResultObligation(ctx:Parameters<typeof runClinicalCommand>[0],resultId:string,evidence:string,occurredAt:string):Promise<void>{
 const obligationId=criticalObligationId(resultId);
 const folded=foldObligation(await readAggregateEvents(ctx,obligationId));
 if(!folded.exists||(folded.state!=="OPEN"&&folded.state!=="IN_PROGRESS"))return;
 const cmd=buildCommand({idempotencyKey:derivedUuid(resultId,"critical-result-obligation-closed"),aggregateType:"ClinicalObligation",aggregateId:obligationId,expectedVersion:folded.version,eventType:"OBLIGATION_COMPLETED",payload:{kind:"COMPLETED",evidence:`Resultado crítico cerrado: ${evidence}`,sourceResultId:resultId},occurredAt,topic:"obligation.completed"});
 let r=await lookupReplay(ctx,cmd);if(!r)r=await runClinicalCommand(ctx,cmd);
}
export async function handleResultClosure(req:Request,resultId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,resultId);
  const b=await parseJson(req,CloseBody);
  const res=await commitTransition(ctx,idempotencyKey,expectedVersion,resultId,folded,"CLOSED","RESULT_CLOSED",{kind:"CLOSED",evidence:b.evidence},b.occurredAt,"result.closed");
  if(res.status===201)await completeCriticalResultObligation(ctx,resultId,b.evidence,b.occurredAt); // C-20: el cierre completa la obligación derivada
  return res;
  // Zero Lost Follow-Up: cerrar un resultado CRÍTICO desde ACTIONED (con evidencia de que el paciente
  // fue contactado y tratado) ES la resolución del loop — debe permitirse. La transición válida
  // ACTIONED->CLOSED la garantiza la máquina de estados (assertResultTransition en commitTransition).
  // El cierre exige evidencia no vacía (CloseBody); mientras el resultado siga en ACTIONED, el gate de
  // firma del encuentro lo cuenta como crítico abierto y bloquea la firma (Zero Lost Follow-Up).
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
