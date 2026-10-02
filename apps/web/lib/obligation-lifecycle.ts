import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldObligation,assertObligationTransition,type FoldedObligation,type ObligationSt}from"../../../packages/obligation-fold/src";
import{runClinicalCommand,lookupReplay,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
import{decideDueAt,dueAtPayload,dueWindowFor}from"../../../packages/obligation-domain/src";
// EPIC O — Ciclo de vida de la obligación (seguimiento): OPEN -> IN_PROGRESS -> COMPLETED / CANCELLED.
// Completar exige EVIDENCIA (Zero Lost Follow-Up: nada se cierra sin constancia). Scope obligation:write.
const AGG="ClinicalObligation";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"obligation:write",purpose:"TREATMENT"});
}

// EPIC AS (profundidad): `sourceVitalId` opcional liga la obligación a un signo vital CRÍTICO. Al existir
// una obligación con este sourceVitalId, countOpenCriticalVitals deja de contar ese vital como "sin atender"
// (se cierra el lazo Zero Lost Follow-Up de vitales críticos y se desbloquea la firma del encuentro).
// Auditoría L-01: `priority` viaja en el evento (por defecto ROUTINE). URGENT sin resolver bloquea la firma; también cualquier
// obligación VENCIDA. `sourceResultId` liga la obligación al resultado crítico que la originó (trazabilidad del lazo).
// Auditoría R05a-F04: `dueAt` es OPCIONAL y su techo lo pone el SERVIDOR según el tipo y la prioridad (obligation-domain).
// La pantalla enviaba «hoy + 7 días» para toda obligación nueva —urgente o de rutina, de cualquier tipo— y el servidor
// aceptaba esa fecha sin mirarla. Si el cliente pide una fecha, se respeta cuando es más próxima que el techo de esa
// severidad y se recorta cuando es más lejana, anotando en el evento la fecha pedida y el recorte.
export const CreateBody=z.object({obligationId:z.string().uuid(),patientId:z.string().uuid(),ownerId:z.string().uuid(),dueAt:z.string().datetime().optional(),kind:z.string().min(1).max(200),
 priority:z.enum(["URGENT","HIGH","ROUTINE"]).default("ROUTINE"),sourceVitalId:z.string().uuid().optional(),sourceResultId:z.string().uuid().optional(),occurredAt:z.string().datetime()});
export async function handleObligationCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  // El plazo se deriva de `occurredAt`, no del reloj: el payload de un reintento tiene que ser idéntico.
  const due=decideDueAt(b.occurredAt,b.dueAt,dueWindowFor(b.kind,b.priority));
  const payload:Record<string,unknown>={kind:"CREATED",patientId:b.patientId,ownerId:b.ownerId,...dueAtPayload(due),obligationKind:b.kind,priority:b.priority};
  if(b.sourceVitalId)payload["sourceVitalId"]=b.sourceVitalId;if(b.sourceResultId)payload["sourceResultId"]=b.sourceResultId;
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.obligationId,expectedVersion:0,eventType:"OBLIGATION_CREATED",payload,occurredAt:b.occurredAt,topic:"obligation.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  // La respuesta dice el plazo EFECTIVO y si se recortó: quien lo pidió tiene que poder verlo, no enterarse por el expediente.
  return NextResponse.json({obligationId:b.obligationId,state:"OPEN",priority:b.priority,dueAt:due.dueAt,dueAtClamped:due.clamped,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedObligation,ObligationSt>({aggregateType:AGG,idKey:"obligationId",notFound:"Obligation not found",fold:foldObligation,assertTransition:assertObligationTransition,authz});
const loadForTransition=(req:Request,obligationId:string)=>LIFECYCLE.loadForTransition(req,obligationId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,obligationId:string,folded:FoldedObligation,to:ObligationSt,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,obligationId,folded,to,eventType,payload,occurredAt,topic);

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleObligationProgress(req:Request,obligationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,obligationId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,obligationId,folded,"IN_PROGRESS","OBLIGATION_STARTED",{kind:"STARTED"},b.occurredAt,"obligation.started");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// Completar EXIGE evidencia (constancia del seguimiento realizado).
export const CompleteBody=z.object({evidence:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleObligationCompletion(req:Request,obligationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,obligationId);const b=await parseJson(req,CompleteBody);
  return await commit(ctx,idempotencyKey,expectedVersion,obligationId,folded,"COMPLETED","OBLIGATION_COMPLETED",{kind:"COMPLETED",evidence:b.evidence},b.occurredAt,"obligation.completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleObligationCancellation(req:Request,obligationId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,obligationId);const b=await parseJson(req,CancelBody);
  return await commit(ctx,idempotencyKey,expectedVersion,obligationId,folded,"CANCELLED","OBLIGATION_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"obligation.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
