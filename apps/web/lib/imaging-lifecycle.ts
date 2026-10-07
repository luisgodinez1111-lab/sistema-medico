// ⚠️ NOT_WIRED (endurecimiento G / Epic BF): este handler NO está cableado a ninguna ruta (código inalcanzable).
// Ver docs/adjudication/not-wired-registry.json. R6 (IA) EN PAUSA: no activar. No cuenta como capacidad end-to-end.
import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldImagingOrder,assertImagingTransition,DICOM_MODALITIES,type FoldedImagingOrder,type ImagingOrderState}from"../../../packages/imaging-order/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson,derivedUuid}from"./http-command";
import{OBLIGATION_DUE_WINDOWS,dueAtFrom}from"../../../packages/obligation-domain/src";
// EPIC Q — Ciclo de vida de orden de imagen (Radiología/Imagen).
// SM: DRAFT -> ORDERED -> ACQUIRED -> REPORTED -> VERIFIED -> SIGNED -> CANCELLED.
// Physician Control: ordenar/adquirir/reportar/verificar/firmar exige médico.
// DICOM: modality, studyInstanceUID, seriesInstanceUID, SOPInstanceUID en payloads.
// EXEC-0016: Imagen con hallazgo crítico -> obligación URGENTE (CRITICAL_IMAGING_REVIEW) -> cuenta en el gate de firma
// del encuentro, igual que un valor de pánico de laboratorio. Implementado el 06-oct-2026 (R02a-IMG-01): hasta esa fecha
// esta línea era una promesa que el código no cumplía.

const AGG="ImagingOrder";

function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string},requirePhysician=false){
 const opts:{role?:string;scope:string;purpose?:string}={scope:"imaging:write",purpose:"TREATMENT"};
 if(requirePhysician)opts.role="PHYSICIAN";
 authorize(principalFrom(claims),opts);
}

// Auditoría 2026-09-19, anexo R02a (R02a-IMG-01) — EL VALIDADOR DE MODALIDAD NO SE USABA.
//
// `packages/imaging-order` exporta `DICOM_MODALITIES` y `validateModality`, y **nadie los importaba**: este fichero solo
// traía el fold y la máquina de estados, y `modality` entraba como texto libre. Una modalidad libre no es un detalle de
// estilo: es lo que decide a qué equipo se agenda el estudio y con qué estudio DICOM se empareja después. «TAC», «tac»,
// «Tomografía» y «CT» serían cuatro modalidades distintas para el sistema y la misma para el paciente.
//
// Se valida con el ENUM, no con el validador llamado a mano, porque así la lista válida aparece en el OpenAPI generado y
// el error que recibe el cliente dice qué valores existen en lugar de «modality inválida».
const CreateBody=z.object({orderId:z.string().uuid(),patientId:z.string().uuid(),modality:z.enum(DICOM_MODALITIES),bodyPart:z.string().min(1),indication:z.string().optional(),priority:z.enum(["ROUTINE","URGENT","STAT"]).default("ROUTINE"),occurredAt:z.string().datetime()});

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
// Auditoría 2026-09-19, anexo R02a (R02a-IMG-01) — «HALLAZGO CRÍTICO → OBLIGACIÓN» ERA UN COMENTARIO, NO CÓDIGO.
//
// La cabecera de este fichero promete desde el primer día: «EXEC-0016: Imagen con hallazgo crítico -> obligación ->
// bloquea firma encuentro». No existía ni una línea que lo hiciera. Un resultado de laboratorio crítico creaba su
// obligación urgente; un neumotórax a tensión o una hemorragia intracraneal se escribían en el informe y, si nadie leía
// ese informe, NO quedaba ningún pendiente que lo persiguiera. Es un agujero de Zero-Lost-Follow-Up en una vertical
// entera, y la clase de defecto más peligrosa de esta auditoría: una promesa documentada que el código desmiente.
//
// `criticalFinding` lo declara el RADIÓLOGO, no se deriva del texto: ningún analizador de cadenas debe decidir si una
// imagen es crítica, y fingir que se puede sería peor que preguntarlo. Y un hallazgo crítico EXIGE describirlo: marcar
// la casilla sin decir qué se vio no permite actuar.
const ReportBody=z.object({reportText:z.string().min(1),findings:z.string().optional(),impression:z.string().optional(),
 criticalFinding:z.boolean().default(false),criticalFindingText:z.string().trim().min(10).optional(),
 radiologistId:z.string().uuid(),occurredAt:z.string().datetime()});
/** Id de la obligación derivada del hallazgo crítico: derivado del estudio, así que un reintento no crea dos. */
export const criticalImagingObligationId=(orderId:string)=>derivedUuid(orderId,"critical-imaging-obligation");
/**
 * La obligación derivada de un hallazgo crítico de imagen. Mismo mecanismo que el resultado de laboratorio crítico
 * (`createResultFollowUpObligation`): id e idempotencia DERIVADOS del estudio, así que un reintento del informe no crea
 * dos pendientes, y el plazo sale del catálogo declarado (`CRITICAL_IMAGING_REVIEW`) en lugar de escribirse aquí.
 */
async function createCriticalImagingObligation(ctx:Parameters<typeof runClinicalCommand>[0],orderId:string,patientId:string,ownerId:string,modality:string,bodyPart:string,hallazgo:string,occurredAt:string):Promise<void>{
 const obligationId=criticalImagingObligationId(orderId);
 const w=OBLIGATION_DUE_WINDOWS["CRITICAL_IMAGING_REVIEW"];
 if(!w)throw new ClinicalError("INVARIANT_VIOLATION","Falta la ventana CRITICAL_IMAGING_REVIEW en el catálogo de obligaciones");
 const cmd=buildCommand({idempotencyKey:derivedUuid(orderId,"critical-imaging-obligation-idem"),
  aggregateType:"ClinicalObligation",aggregateId:obligationId,expectedVersion:0,eventType:"OBLIGATION_CREATED",
  payload:{kind:"CREATED",patientId,ownerId,dueAt:dueAtFrom(occurredAt,w),obligationKind:"CRITICAL_IMAGING_REVIEW",priority:"URGENT",
   sourceImagingOrderId:orderId,study:`${modality} de ${bodyPart}`,
   note:`Hallazgo crítico en ${modality} de ${bodyPart}: ${hallazgo}. Contactar al paciente, actuar y cerrar con evidencia`},
  occurredAt,topic:"obligation.created"});
 let r=await lookupReplay(ctx,cmd);if(!r)r=await runClinicalCommand(ctx,cmd);
}
export async function handleImagingOrderReport(req:Request,orderId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,orderId,true);
  const b=await parseJson(req,ReportBody);
  // Un hallazgo crítico sin describir no permite actuar: marcar la casilla no es reportar.
  if(b.criticalFinding&&!b.criticalFindingText)
   throw new ClinicalError("VALIDATION_ERROR","Describa el hallazgo crítico (criticalFindingText): un pendiente urgente sin decir qué se vio no permite actuar",{conflictReason:"CRITICAL_FINDING_TEXT_REQUIRED"});
  const res=await commit(ctx,idempotencyKey,expectedVersion,orderId,folded,"REPORTED","IMAGING_ORDER_REPORTED",
   {kind:"REPORTED",reportText:b.reportText,findings:b.findings,impression:b.impression,radiologistId:b.radiologistId,
    criticalFinding:b.criticalFinding,...(b.criticalFindingText?{criticalFindingText:b.criticalFindingText}:{})},
   b.occurredAt,"imaging.order.reported");
  // La obligación se crea DESPUÉS de que el informe quedó asentado: si el informe falla no debe quedar un pendiente
  // huérfano, y si la obligación fallara el informe ya está en el expediente (que es el dato clínico irrenunciable).
  // No es atómico a propósito y se dice: la idempotencia derivada hace que un reintento del informe la complete.
  if(b.criticalFinding&&res.status<400&&folded.patientId)
   await createCriticalImagingObligation(ctx,orderId,folded.patientId,ctx.actorId,folded.modality,folded.bodyPart,b.criticalFindingText!,b.occurredAt);
  return res;
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