import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldResult,assertResultTransition,type FoldedResult}from"../../../packages/result-fold/src";
import{type ResultState}from"../../../packages/order-result-domain/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,latestResultValueForAnalyte}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{classifyLab,normalizeLabValue,deltaCheck}from"../../../packages/lab-reference/src";
// EPIC G — Ciclo de vida del resultado diagnóstico (closed-loop de seguimiento) sobre el kernel.
// EPIC AQ (profundidad): si se envía analito+valor, el flag `critical` se DERIVA del valor (valores de pánico).
// RECEIVED -> VERIFIED -> ACTIONED (obligación) -> CLOSED. Un resultado CRÍTICO en ACTIONED sin
// cerrar bloquea la firma del encuentro del paciente (Zero Lost Follow-Up, ver encounter-lifecycle).
const AGG="DiagnosticResult";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,role:"PHYSICIAN",scope:"result:write",purpose:"TREATMENT"});
}

// `unit` (unidad en que se reporta el valor) y `specimenId` (muestra de la que sale) son opcionales por compatibilidad,
// pero son la base de toda calculadora: sin unidad, el valor se asume en la canónica y queda marcado `unitAssumed`.
const ReceiveBody=z.object({resultId:z.string().uuid(),patientId:z.string().uuid(),orderId:z.string().uuid(),analyte:z.string().min(1).max(60),value:z.string().min(1).max(60),unit:z.string().max(24).optional(),specimenId:z.string().uuid().optional(),occurredAt:z.string().datetime()});
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
  const prior=await latestResultValueForAnalyte(ctx,b.patientId,b.analyte,b.resultId);
  const current=norm.ok?String(norm.canonicalValue):b.value;
  const delta=prior!==undefined?deltaCheck(b.analyte,prior,current):{flagged:false,severity:"NONE" as const,changeAbs:0,changePct:0,note:""};
  const critical=assessment.critical||delta.flagged;
  const interpretation=delta.flagged?`${assessment.interpretation} · Δ crítico vs previo (${prior}→${b.value}): ${delta.note}`:assessment.interpretation;
  const payload:Record<string,unknown>={kind:"RECEIVED",patientId:b.patientId,orderId:b.orderId,critical,status:delta.flagged?"CRITICAL":assessment.status,interpretation,analyte:b.analyte,value:b.value};
  if(norm.ok){payload["unit"]=b.unit?.trim()||null;payload["canonicalValue"]=norm.canonicalValue;payload["canonicalUnit"]=norm.canonicalUnit;payload["unitAssumed"]=norm.unitAssumed;}
  if(b.specimenId)payload["specimenId"]=b.specimenId;
  if(delta.flagged){payload["deltaFlagged"]=true;payload["deltaSeverity"]=delta.severity;payload["deltaChangeAbs"]=delta.changeAbs;payload["deltaChangePct"]=delta.changePct;payload["priorValue"]=prior;}
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.resultId,expectedVersion:0,eventType:"RESULT_RECEIVED",payload,occurredAt:b.occurredAt,topic:"result.received"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  // La respuesta dice la VERDAD de la interpretación: NORMAL / ABNORMAL / CRITICAL / UNKNOWN (antes solo `critical`, y la UI
  // anunciaba "dentro de rango" para todo lo no crítico, incluidos valores anormales y analitos sin rango tabulado).
  return NextResponse.json({resultId:b.resultId,state:"RECEIVED",critical,status:payload["status"],interpretation,deltaFlagged:delta.flagged,
   ...(norm.ok?{canonicalValue:norm.canonicalValue,canonicalUnit:norm.canonicalUnit,unitAssumed:norm.unitAssumed}:{}),
   version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
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

const VerifyBody=z.object({occurredAt:z.string().datetime()});
export async function handleResultVerification(req:Request,resultId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,resultId);
  const b=await parseJson(req,VerifyBody);
  return await commitTransition(ctx,idempotencyKey,expectedVersion,resultId,folded,"VERIFIED","RESULT_VERIFIED",{kind:"VERIFIED"},b.occurredAt,"result.verified");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// ACTION = requerir acción (crea la obligación). Un resultado crítico exige owner + due date.
const ActionBody=z.object({ownerId:z.string().uuid(),dueAt:z.string().datetime(),occurredAt:z.string().datetime()});
export async function handleResultAction(req:Request,resultId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,resultId);
  const b=await parseJson(req,ActionBody);
  // payload lleva patientId + critical para que el gate de firma pueda contar sin proyección.
  return await commitTransition(ctx,idempotencyKey,expectedVersion,resultId,folded,"ACTIONED","RESULT_ACTION_REQUIRED",{kind:"ACTIONED",patientId:folded.patientId,critical:folded.critical,ownerId:b.ownerId,dueAt:b.dueAt},b.occurredAt,"result.action_required");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// CLOSURE = cierre con evidencia (resuelve la obligación -> desbloquea la firma).
const CloseBody=z.object({evidence:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleResultClosure(req:Request,resultId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,resultId);
  const b=await parseJson(req,CloseBody);
  // Zero Lost Follow-Up: cerrar un resultado CRÍTICO desde ACTIONED (con evidencia de que el paciente
  // fue contactado y tratado) ES la resolución del loop — debe permitirse. La transición válida
  // ACTIONED->CLOSED la garantiza la máquina de estados (assertResultTransition en commitTransition).
  // El cierre exige evidencia no vacía (CloseBody); mientras el resultado siga en ACTIONED, el gate de
  // firma del encuentro lo cuenta como crítico abierto y bloquea la firma (Zero Lost Follow-Up).
  return await commitTransition(ctx,idempotencyKey,expectedVersion,resultId,folded,"CLOSED","RESULT_CLOSED",{kind:"CLOSED",evidence:b.evidence},b.occurredAt,"result.closed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
