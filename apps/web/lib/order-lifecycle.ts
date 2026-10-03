import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldOrder,assertOrderTransition,type FoldedOrder}from"../../../packages/order-fold/src";
import{type OrderState}from"../../../packages/order-result-domain/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC M — Ciclo de vida de la orden clínica: DRAFT -> ORDERED -> FULFILLED (o CANCELLED).
// Physician Control: colocar/cumplir/cancelar una orden exige médico (scope order:write).
const AGG="ClinicalOrder";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{role:"PHYSICIAN",scope:"order:write",purpose:"TREATMENT"});
}

// Auditoría 2026-09-19, anexo R02a (ORD-01) — SLA de la orden. Una orden colocada sin resultado se quedaba en `ORDERED`
// para siempre: ninguna consulta, ninguna alerta, ninguna obligación. En una clínica eso es un estudio perdido, que es el
// modo de fallo que este sistema dice evitar (Zero-Lost-Follow-Up).
//
// El SLA por defecto depende de la URGENCIA declarada por quien ordena, no del tipo de estudio: un hemograma URGENTE se
// espera en horas y uno de rutina en días. Los plazos son criterio conservador de ingeniería (documentado como tal, no
// como norma clínica): un médico puede ajustarlos por tipo de estudio, y `dueAt` explícito siempre gana.
export const ORDER_PRIORITIES=["ROUTINE","URGENT","STAT"] as const;
export const ORDER_SLA_HOURS:Readonly<Record<(typeof ORDER_PRIORITIES)[number],number>>={STAT:2,URGENT:24,ROUTINE:168}; // 2 h · 1 día · 7 días
export const CreateBody=z.object({orderId:z.string().uuid(),patientId:z.string().uuid(),orderType:z.enum(["LAB","IMAGING","PATHOLOGY","PROCEDURE","REFERRAL"]),detail:z.string().min(1),
 priority:z.enum(ORDER_PRIORITIES).optional(),
 /** POMR (expediente orientado a problemas): el problema clínico (ClinicalProblem.aggregateId) CONTRA el que se solicita el
  * estudio. Aditivo y opcional (no rompe la FSM ni las órdenes existentes); permite reconstruir "qué se pidió para qué dx". */
 problemId:z.string().uuid().optional(),
 /** Vencimiento explícito; si no se declara se deriva de la prioridad al COLOCAR la orden. */
 dueAt:z.string().datetime().optional(),
 occurredAt:z.string().datetime()});
export async function handleOrderCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.orderId,expectedVersion:0,eventType:"ORDER_CREATED",payload:{kind:"CREATED",patientId:b.patientId,orderType:b.orderType,detail:b.detail,...(b.problemId?{problemId:b.problemId}:{}),...(b.priority?{priority:b.priority}:{}),...(b.dueAt?{dueAt:b.dueAt}:{})},occurredAt:b.occurredAt,topic:"order.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({orderId:b.orderId,state:"DRAFT",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedOrder,OrderState>({aggregateType:AGG,idKey:"orderId",notFound:"Order not found",fold:foldOrder,assertTransition:assertOrderTransition,authz});
const loadForTransition=(req:Request,orderId:string)=>LIFECYCLE.loadForTransition(req,orderId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,orderId:string,folded:FoldedOrder,to:OrderState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,orderId,folded,to,eventType,payload,occurredAt,topic);

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export const PlaceBody=z.object({occurredAt:z.string().datetime(),priority:z.enum(ORDER_PRIORITIES).optional(),dueAt:z.string().datetime().optional()});
export async function handleOrderPlacement(req:Request,orderId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId);const b=await parseJson(req,PlaceBody);
  // R02a-ORD-01: al COLOCAR la orden queda fijado su vencimiento. Sin esto no había forma de saber qué está retrasado.
  // La prioridad del fold llega como string (viene del payload jsonb): se estrecha al vocabulario, y lo que no
  // pertenezca se trata como ROUTINE en vez de dejar un plazo indefinido.
  const esPrioridad=(v:string|undefined):v is (typeof ORDER_PRIORITIES)[number]=>v!==undefined&&(ORDER_PRIORITIES as readonly string[]).includes(v);
  const priority=b.priority??(esPrioridad(folded.priority)?folded.priority:"ROUTINE");
  const dueAt=b.dueAt??folded.dueAt??new Date(Date.parse(b.occurredAt)+ORDER_SLA_HOURS[priority]*3_600_000).toISOString();
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"ORDERED","ORDER_PLACED",{kind:"PLACED",priority,dueAt},b.occurredAt,"order.placed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleOrderFulfillment(req:Request,orderId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"FULFILLED","ORDER_FULFILLED",{kind:"FULFILLED"},b.occurredAt,"order.fulfilled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleOrderCancellation(req:Request,orderId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId);const b=await parseJson(req,CancelBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"CANCELLED","ORDER_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"order.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
