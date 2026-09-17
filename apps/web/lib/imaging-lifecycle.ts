// ⚠️ NOT_WIRED (endurecimiento G / Epic BF): este handler NO está cableado a ninguna ruta (código inalcanzable).
// Ver docs/adjudication/not-wired-registry.json. R6 (IA) EN PAUSA: no activar. No cuenta como capacidad end-to-end.
import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldImagingOrder,assertImagingTransition,type FoldedImagingOrder,type ImagingOrderState}from"../../../packages/imaging-order/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC Q — Ciclo de vida de orden de imagen (Radiología/Imagen).
// SM: DRAFT -> ORDERED -> ACQUIRED -> REPORTED -> VERIFIED -> SIGNED -> CANCELLED.
// Physician Control: ordenar/adquirir/reportar/verificar/firmar exige médico.
// DICOM: modality, studyInstanceUID, seriesInstanceUID, SOPInstanceUID en payloads.
// EXEC-0016: Imagen con hallazgo crítico -> obligación -> bloquea firma encuentro.

const AGG="ImagingOrder";

function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string},requirePhysician=false){
 const opts:{tenantId:string;role?:string;scope?:string;purpose?:string}={tenantId:claims.tenantId,scope:"imaging:write",purpose:"TREATMENT"};
 if(requirePhysician)opts.role="PHYSICIAN";
 authorize(principalFrom(claims),opts);
}

const CreateBody=z.object({orderId:z.string().uuid(),patientId:z.string().uuid(),modality:z.string().min(1),bodyPart:z.string().min(1),indication:z.string().optional(),priority:z.enum(["ROUTINE","URGENT","STAT"]).default("ROUTINE"),occurredAt:z.string().datetime()});

export async function handleImagingOrderCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.orderId,expectedVersion:0,eventType:"IMAGING_ORDER_CREATED",payload:{kind:"CREATED",patientId:b.patientId,modality:b.modality,bodyPart:b.bodyPart,indication:b.indication,priority:b.priority},occurredAt:b.occurredAt,topic:"imaging.order.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({orderId:b.orderId,state:"DRAFT",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,orderId:string,requirePhysician=false){
 const{claims,ctx}=resolveVerified(req);
 authz(claims,requirePhysician);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldImagingOrder(await readAggregateEvents(ctx,orderId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Imaging order not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,orderId:string,folded:FoldedImagingOrder,to:ImagingOrderState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:orderId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertImagingTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({orderId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});

// PLACE = DRAFT -> ORDERED. Physician Control.
export async function handleImagingOrderPlace(req:Request,orderId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId,true);
  const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"ORDERED","IMAGING_ORDER_PLACED",{kind:"PLACED"},b.occurredAt,"imaging.order.placed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// ACQUIRE = ORDERED -> ACQUIRED. Technologist acquires images (DICOM push from modality).
const AcquireBody=z.object({technologistId:z.string().uuid(),studyInstanceUID:z.string().min(1),seriesCount:z.number().int().positive().default(1),acquiredAt:z.string().datetime(),occurredAt:z.string().datetime()});
export async function handleImagingOrderAcquire(req:Request,orderId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId,false);
  const b=await parseJson(req,AcquireBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"ACQUIRED","IMAGING_ORDER_ACQUIRED",{kind:"ACQUIRED",technologistId:b.technologistId,studyInstanceUID:b.studyInstanceUID,seriesCount:b.seriesCount,acquiredAt:b.acquiredAt},b.occurredAt,"imaging.order.acquired");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// REPORT = ACQUIRED -> REPORTED. Radiologist creates report (integrates with document-ingestion).
const ReportBody=z.object({reportText:z.string().min(1),findings:z.string().optional(),impression:z.string().optional(),radiologistId:z.string().uuid(),occurredAt:z.string().datetime()});
export async function handleImagingOrderReport(req:Request,orderId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId,true);
  const b=await parseJson(req,ReportBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"REPORTED","IMAGING_ORDER_REPORTED",{kind:"REPORTED",reportText:b.reportText,findings:b.findings,impression:b.impression,radiologistId:b.radiologistId},b.occurredAt,"imaging.order.reported");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// VERIFY = REPORTED -> VERIFIED. Second radiologist/attending verifies.
const VerifyBody=z.object({verifierId:z.string().uuid(),notes:z.string().optional(),occurredAt:z.string().datetime()});
export async function handleImagingOrderVerify(req:Request,orderId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId,true);
  const b=await parseJson(req,VerifyBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"VERIFIED","IMAGING_ORDER_VERIFIED",{kind:"VERIFIED",verifierId:b.verifierId,notes:b.notes},b.occurredAt,"imaging.order.verified");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// SIGN = VERIFIED -> SIGNED. Final legal signature (document-fold integration).
const SignBody=z.object({signerId:z.string().uuid(),occurredAt:z.string().datetime()});
export async function handleImagingOrderSign(req:Request,orderId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId,true);
  const b=await parseJson(req,SignBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"SIGNED","IMAGING_ORDER_SIGNED",{kind:"SIGNED",signerId:b.signerId},b.occurredAt,"imaging.order.signed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// CANCEL = DRAFT/ORDERED/ACQUIRED -> CANCELLED.
const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleImagingOrderCancel(req:Request,orderId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId,true);
  const b=await parseJson(req,CancelBody);
  return await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"CANCELLED","IMAGING_ORDER_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"imaging.order.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}