// ⚠️ NOT_WIRED (endurecimiento G / Epic BF): este handler NO está cableado a ninguna ruta (código inalcanzable).
// Ver docs/adjudication/not-wired-registry.json. R6 (IA) EN PAUSA: no activar. No cuenta como capacidad end-to-end.
import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldOrder,assertOrderTransition,type FoldedOrder}from"../../../packages/order-fold/src";
import{type OrderState}from"../../../packages/order-result-domain/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{classifyLab,type LabAssessment}from"../../../packages/lab-reference/src";
// EPIC L — Ciclo de vida de orden de laboratorio (LAB).
// SM: DRAFT -> ORDERED -> COLLECTED -> RECEIVED -> VERIFIED -> REPORTED -> (CLOSED/CORRECTED).
// Physician Control: ordenar/verificar/reportar exige médico.
// EXEC-0016: closed-loop resultados críticos -> obligación -> cierre -> desbloquea firma encuentro.
// EXEC-0014: classifyLab deriva critical/panic del valor real, no del booleano del cliente.

const AGG="LabOrder";

function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string},requirePhysician=false){
 const opts:{tenantId:string;role?:string;scope:string;purpose?:string}={tenantId:claims.tenantId,scope:"order:write",purpose:"TREATMENT"};
 if(requirePhysician)opts.role="PHYSICIAN";
 authorize(principalFrom(claims),opts);
}

const CreateBody=z.object({orderId:z.string().uuid(),patientId:z.string().uuid(),panelCode:z.string().min(1),analytes:z.array(z.string()).min(1),priority:z.enum(["ROUTINE","URGENT","STAT"]).default("ROUTINE"),occurredAt:z.string().datetime()});

// CREATE = DRAFT. Cualquier clínico con scope order:write.
export async function handleLabOrderCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.orderId,expectedVersion:0,eventType:"LAB_ORDER_CREATED",payload:{kind:"CREATED",patientId:b.patientId,panelCode:b.panelCode,analytes:b.analytes,priority:b.priority},occurredAt:b.occurredAt,topic:"lab.order.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({orderId:b.orderId,state:"DRAFT",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,orderId:string,requirePhysician=false){
 const{claims,ctx}=resolveVerified(req);
 authz(claims,requirePhysician);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldOrder(await readAggregateEvents(ctx,orderId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Lab order not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,orderId:string,folded:FoldedOrder,to:OrderState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:orderId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertOrderTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({orderId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});

// PLACE = DRAFT -> ORDERED. Physician Control.
export async function handleLabOrderPlace(req:Request,orderId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId,true);
  const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"ORDERED","LAB_ORDER_PLACED",{kind:"PLACED"},b.occurredAt,"lab.order.placed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// COLLECT = ORDERED -> COLLECTED. Sample collected (phlebotomist/technician).
const CollectBody=z.object({collectorId:z.string().uuid(),collectedAt:z.string().datetime(),occurredAt:z.string().datetime()});
export async function handleLabOrderCollect(req:Request,orderId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId,false);
  const b=await parseJson(req,CollectBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"FULFILLED","LAB_ORDER_COLLECTED",{kind:"COLLECTED",collectorId:b.collectorId,collectedAt:b.collectedAt},b.occurredAt,"lab.order.collected");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// RECEIVE = External lab system pushes result. Creates DiagnosticResult aggregate.
// EXEC-0016: RECEIVED -> VERIFIED -> ACTIONED -> CLOSED. Critical flag derivado del valor (classifyLab).
const ReceiveBody=z.object({resultId:z.string().uuid(),patientId:z.string().uuid(),orderId:z.string().uuid(),analyte:z.string(),value:z.string(),unit:z.string(),referenceRange:z.string().optional(),occurredAt:z.string().datetime()});
export async function handleLabResultReceive(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"result:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ReceiveBody);
  // Derivar critical/status del valor real usando lab-reference (EXEC-0014)
  const assessment:LabAssessment=classifyLab(b.analyte,b.value);
  const cmd=buildCommand({idempotencyKey,aggregateType:"DiagnosticResult",aggregateId:b.resultId,expectedVersion:0,eventType:"RESULT_RECEIVED",payload:{kind:"RECEIVED",patientId:b.patientId,orderId:b.orderId,critical:assessment.critical,status:assessment.status,interpretation:assessment.interpretation,analyte:b.analyte,value:b.value,unit:b.unit,referenceRange:b.referenceRange},occurredAt:b.occurredAt,topic:"result.received"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  // Actualizar estado de la orden a FULFILLED si todos los analitos recibidos
  return NextResponse.json({resultId:b.resultId,state:"RECEIVED",version:r.version,auditHash:r.auditHash,critical:assessment.critical,status:assessment.status,interpretation:assessment.interpretation,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// VERIFY = RECEIVED -> VERIFIED. Physician reviews result.
const VerifyBody=z.object({occurredAt:z.string().datetime()});
export async function handleLabResultVerify(req:Request,resultId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,role:"PHYSICIAN",scope:"result:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,VerifyBody);
  // Load result aggregate
  const events=await readAggregateEvents(ctx,resultId);
  const folded=events.length>0?{exists:true,state:"RECEIVED",version:events.length,patientId:String(events[0]?.payload["patientId"]??"")}:{exists:false,state:"EXPECTED",version:0,patientId:""};
  if(!folded.exists)throw new ClinicalError("NOT_FOUND","Result not found");
  const cmd=buildCommand({idempotencyKey,aggregateType:"DiagnosticResult",aggregateId:resultId,expectedVersion:folded.version,eventType:"RESULT_VERIFIED",payload:{kind:"VERIFIED"},occurredAt:b.occurredAt,topic:"result.verified"});
  let result=await lookupReplay(ctx,cmd);
  if(!result){result=await runClinicalCommand(ctx,cmd);}
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({resultId,state:"VERIFIED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// REPORT = VERIFIED -> REPORTED. Final report signed by pathologist.
const ReportBody=z.object({reportText:z.string().min(1),pathologistId:z.string().uuid(),occurredAt:z.string().datetime()});
export async function handleLabResultReport(req:Request,resultId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,role:"PHYSICIAN",scope:"result:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ReportBody);
  const events=await readAggregateEvents(ctx,resultId);
  const folded=events.length>0?{exists:true,state:"VERIFIED",version:events.length}:{exists:false,state:"EXPECTED",version:0,patientId:""};
  if(!folded.exists)throw new ClinicalError("NOT_FOUND","Result not found");
  const cmd=buildCommand({idempotencyKey,aggregateType:"DiagnosticResult",aggregateId:resultId,expectedVersion:folded.version,eventType:"RESULT_REPORTED",payload:{kind:"REPORTED",reportText:b.reportText,pathologistId:b.pathologistId},occurredAt:b.occurredAt,topic:"result.reported"});
  let result=await lookupReplay(ctx,cmd);
  if(!result){result=await runClinicalCommand(ctx,cmd);}
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({resultId,state:"REPORTED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// CANCEL = DRAFT/ORDERED -> CANCELLED.
const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleLabOrderCancel(req:Request,orderId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId,true);
  const b=await parseJson(req,CancelBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"CANCELLED","LAB_ORDER_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"lab.order.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}