import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldDialysis,assertDialysisTransition,type FoldedDialysis,type DialysisState}from"../../../packages/dialysis-fold/src";
import{dialysisAdequacy,KTV_FORMULA}from"../../../packages/dialysis-adequacy/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC AL — Ciclo de vida de una sesión de diálisis: SCHEDULED -> IN_SESSION -> {COMPLETED, INTERRUPTED};
// INTERRUPTED -> reanudar/completar. Cuidado renal crónico; agendar/iniciar/... exige scope dialysis:write.
const AGG="Dialysis";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"dialysis:write",purpose:"TREATMENT"});
}

// Auditoría 2026-09-19, anexo R02b (R2B-020) — LA PRESCRIPCIÓN DE LA SESIÓN, que antes no existía.
//
// Este ciclo de vida tenía DOS campos clínicos en todo el archivo (`modality` y `accessType`, los dos solo al agendar): ni
// Kt/V, ni peso seco, ni pesos pre y post, ni ultrafiltración, ni duración prescrita frente a la real. El anexo lo llamó por
// su nombre: «literalmente un cronómetro de cuatro estados sin una sola variable de terapia de reemplazo renal».
//
// Al AGENDAR se prescribe: cuánto tiempo y contra qué peso seco. Sin lo prescrito no se puede decir después si la sesión
// cumplió, y «cumplió» es la mitad de la dosis de diálisis.
export const ScheduleBody=z.object({dialysisId:z.string().uuid(),patientId:z.string().uuid(),
 modality:z.enum(["HEMODIALYSIS","PERITONEAL","HEMOFILTRATION"]),
 accessType:z.enum(["FISTULA","GRAFT","CATHETER","PERITONEAL_CATHETER"]),
 prescribedMinutes:z.number().int().min(30).max(600),
 dryWeightKg:z.number().min(1).max(400).optional(),
 occurredAt:z.string().datetime()});
export async function handleDialysisSchedule(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ScheduleBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.dialysisId,expectedVersion:0,eventType:"DIALYSIS_SCHEDULED",payload:{kind:"SCHEDULED",patientId:b.patientId,modality:b.modality,accessType:b.accessType,prescribedMinutes:b.prescribedMinutes,...(b.dryWeightKg===undefined?{}:{dryWeightKg:b.dryWeightKg})},occurredAt:b.occurredAt,topic:"dialysis.scheduled"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({dialysisId:b.dialysisId,state:"SCHEDULED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedDialysis,DialysisState>({aggregateType:AGG,idKey:"dialysisId",notFound:"Dialysis session not found",fold:foldDialysis,assertTransition:assertDialysisTransition,authz});
const loadForTransition=(req:Request,dialysisId:string)=>LIFECYCLE.loadForTransition(req,dialysisId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,dialysisId:string,folded:FoldedDialysis,to:DialysisState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string,extra?:Record<string,unknown>,precondition?:()=>void|Promise<void>)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,to,eventType,payload,occurredAt,topic,extra,precondition);

export const WhenBody=z.object({occurredAt:z.string().datetime()});
// R2B-020: al INICIAR se pesa y, si se tomó, se registra la urea pre. El peso pre es obligatorio: sin él no hay ultrafiltración
// que calcular, y la ultrafiltración es el número asociado a la hipotensión intradiálisis.
export const StartBody=z.object({
 preWeightKg:z.number().min(1).max(400),
 preUreaMgDl:z.number().min(1).max(300).optional(),
 occurredAt:z.string().datetime()});
export async function handleDialysisStart(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,StartBody);
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"IN_SESSION","DIALYSIS_STARTED",
   {kind:"STARTED",preWeightKg:b.preWeightKg,...(b.preUreaMgDl===undefined?{}:{preUreaMgDl:b.preUreaMgDl})},b.occurredAt,"dialysis.started");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleDialysisResumption(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"IN_SESSION","DIALYSIS_RESUMED",{kind:"RESUMED"},b.occurredAt,"dialysis.resumed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// R2B-020: al COMPLETAR se cierra la medición y se CALCULA la adecuación (spKt/V por Daugirdas de 2.ª generación, URR y tasa
// de ultrafiltración). El cálculo se guarda en el evento con la fórmula aplicada, para que una revisión posterior pueda
// recalcularlo desde los mismos datos en vez de creerse el número.
export const CompleteBody=z.object({
 postWeightKg:z.number().min(1).max(400),
 durationMinutes:z.number().int().min(1).max(900),
 postUreaMgDl:z.number().min(1).max(300).optional(),
 occurredAt:z.string().datetime()});
export async function handleDialysisCompletion(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,CompleteBody);
  // Lo prescrito y el peso pre vienen del STREAM, no del cuerpo: si vinieran del cuerpo, quien cierra la sesión podría
  // declarar una prescripción a medida de lo que hizo, y «cumplió lo prescrito» dejaría de significar algo.
  const eventos=await readAggregateEvents(ctx,dialysisId);
  const agendado=eventos.find(e=>e.payload["kind"]==="SCHEDULED")?.payload??{};
  const iniciado=eventos.filter(e=>e.payload["kind"]==="STARTED").at(-1)?.payload??{};
  const preWeightKg=Number(iniciado["preWeightKg"]??0);
  // La falta del peso pre se comprueba como PRECONDICIÓN del commit, no aquí: la fábrica la evalúa DESPUÉS de la máquina de
  // estados, y ese orden importa. Cerrar una sesión que nunca se inició es un 409 («no puedes completar sin iniciar»), no un
  // «falta el peso»: el primer error es el que explica de verdad lo que pasó.
  const faltaPesoPre=()=>{if(!(preWeightKg>0))throw new ClinicalError("PRECONDITION_REQUIRED","La sesión no registró el peso pre-diálisis: no se puede cerrar sin él");};
  const ad=dialysisAdequacy({
   durationMinutes:b.durationMinutes,prescribedMinutes:Number(agendado["prescribedMinutes"]??b.durationMinutes),
   preWeightKg,postWeightKg:b.postWeightKg,
   ...(agendado["dryWeightKg"]===undefined?{}:{dryWeightKg:Number(agendado["dryWeightKg"])}),
   ...(iniciado["preUreaMgDl"]===undefined?{}:{preUreaMgDl:Number(iniciado["preUreaMgDl"])}),
   ...(b.postUreaMgDl===undefined?{}:{postUreaMgDl:b.postUreaMgDl})});
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"COMPLETED","DIALYSIS_COMPLETED",
   {kind:"COMPLETED",postWeightKg:b.postWeightKg,durationMinutes:b.durationMinutes,
    ...(b.postUreaMgDl===undefined?{}:{postUreaMgDl:b.postUreaMgDl}),
    spKtV:ad.spKtV,urrPercent:ad.urrPercent,ultrafiltrationL:ad.ultrafiltrationL,
    ultrafiltrationRateMlKgH:ad.ultrafiltrationRateMlKgH,deltaFromDryWeightKg:ad.deltaFromDryWeightKg,
    shortfallMinutes:ad.shortfallMinutes,adequacyMissing:ad.missing,adequacyWarnings:ad.warnings,ktvFormula:KTV_FORMULA},
   b.occurredAt,"dialysis.completed",
   {adequacy:{spKtV:ad.spKtV,urrPercent:ad.urrPercent,ultrafiltrationL:ad.ultrafiltrationL,
    ultrafiltrationRateMlKgH:ad.ultrafiltrationRateMlKgH,deltaFromDryWeightKg:ad.deltaFromDryWeightKg,
    shortfallMinutes:ad.shortfallMinutes,missing:ad.missing,warnings:ad.warnings,formula:ad.formula}},
   faltaPesoPre);
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
// R2B-020: interrumpir llevaba SOLO un texto libre. La hipotensión intradiálisis es la complicación frecuente y la razón por
// la que la tasa de ultrafiltración importa; con el motivo en prosa no se puede contar cuántas sesiones se interrumpieron por
// ella ni relacionarlo con la UF. Ahora la CAUSA es un enum y el texto sigue estando para lo que el enum no cubre.
export const INTERRUPTION_CAUSES=["HIPOTENSION","CALAMBRES","ARRITMIA","DOLOR_TORACICO","COAGULACION_CIRCUITO",
 "PROBLEMA_ACCESO","FALLA_EQUIPO","DECISION_PACIENTE","OTRA"] as const;
export const InterruptBody=z.object({
 cause:z.enum(INTERRUPTION_CAUSES),
 reason:z.string().min(1),
 /** Presión arterial en el momento de interrumpir, si se tomó: es el dato que sostiene o descarta la hipotensión. */
 systolic:z.number().int().min(30).max(300).optional(),
 diastolic:z.number().int().min(10).max(200).optional(),
 occurredAt:z.string().datetime()});
export async function handleDialysisInterruption(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,InterruptBody);
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"INTERRUPTED","DIALYSIS_INTERRUPTED",
   {kind:"INTERRUPTED",cause:b.cause,reason:b.reason,
    ...(b.systolic===undefined?{}:{systolic:b.systolic}),...(b.diastolic===undefined?{}:{diastolic:b.diastolic})},
   b.occurredAt,"dialysis.interrupted");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleDialysisCancellation(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"CANCELLED","DIALYSIS_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"dialysis.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleDialysisNoShow(req:Request,dialysisId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,dialysisId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,dialysisId,folded,"NO_SHOW","DIALYSIS_NO_SHOW",{kind:"NO_SHOW"},b.occurredAt,"dialysis.no_show");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
