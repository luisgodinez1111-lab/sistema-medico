import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldDocument,assertDocumentTransition,type FoldedDocument,type DocumentState}from"../../../packages/document-fold/src";
import{put,del,get}from"@vercel/blob";
import{runClinicalCommand,lookupReplay,readAggregateStream,documentDetail,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{assertReadVersion,buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson,replayStablePayload,priorCommand,uploadThenCommit}from"./http-command";
import{physicianCredentials,assertPhysicianCredentials}from"./physician-profile-lifecycle";
import{deterministicUuid}from"../../../packages/canonical-json/src";
import{signedPayload}from"./clinical-signature";
import{foldEncounter}from"../../../packages/encounter-fold/src";
// EPIC I — Ciclo de vida del documento clínico sobre el kernel. Autoridad PROD-014-R022 /
// PROD-022-R018: la firma produce un snapshot reproducible (contentHash) y las correcciones son
// addendum/amendment APPEND-ONLY; nunca se borra el historial. Physician Control: solo un médico
// humano firma y enmienda (la IA nunca firma el registro clínico-legal).
// EXEC-0009: Draft save y clinical/legal signature son operaciones DISTINTAS. Autosave NUNCA
// masquerade como signature. Encuentro: planned -> arrived -> in_progress -> ready_for_review -> signed -> amended -> closed.
const AGG="ClinicalDocument";
type Claims={sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string};

export const CreateBody=z.object({documentId:z.string().uuid(),patientId:z.string().uuid(),encounterId:z.string().uuid().optional(),docType:z.enum(["PROGRESS_NOTE","DISCHARGE_SUMMARY","REFERRAL","PROCEDURE_NOTE","OTHER"]),title:z.string().trim().min(1,"El título no puede estar vacío").max(300),
 // R02a-ENC-04 (mismo defecto que en el encuentro): " " pasaba como contenido de un documento clínico firmable.
 content:z.string().trim().min(1,"El contenido no puede estar vacío").max(200_000),
 occurredAt:z.string().datetime()});
// CREATE = borrador (draft). Cualquier clínico con scope document:write.
// NO es el registro firmado. Draft save != signature (EXEC-0009).
export async function handleDocumentCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"document:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  // R02a-DOC-03: `encounterId` era un uuid opcional que NADIE validaba: un documento podía declarar pertenecer a un
  // encuentro inexistente o —peor— al encuentro de OTRO paciente, y el expediente quedaba con un vínculo falso. Si se
  // declara, tiene que existir y ser del mismo paciente. Sigue siendo opcional porque hay documentos legítimos sin
  // encuentro (un consentimiento, una referencia externa), pero un vínculo declarado ya no puede ser mentira.
  if(b.encounterId!==undefined){
   const enc=foldEncounter(await readAggregateStream(ctx,"Encounter",b.encounterId));
   if(!enc.exists)throw new ClinicalError("NOT_FOUND","El encuentro declarado no existe en este tenant",{resourceType:"Encounter"});
   if(enc.patientId!==b.patientId)throw new ClinicalError("CONFLICT","El encuentro declarado es de otro paciente",{conflictReason:"ENCOUNTER_PATIENT_MISMATCH"});
  }
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.documentId,expectedVersion:0,eventType:"DOCUMENT_CREATED",payload:{kind:"CREATED",patientId:b.patientId,encounterId:b.encounterId,docType:b.docType,title:b.title,content:b.content},occurredAt:b.occurredAt,topic:"document.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({documentId:b.documentId,state:"DRAFT",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// Auditoría 2026-09-19 (L-03): aquí vivía `handleDocumentAutosave`, un handler SIN RUTA que respondía `autosavedAt` y un
// `contentHash` sin persistir nada. Un "guardado" que no guarda es peor que no tenerlo: se eliminó. El contenido de un
// documento es INMUTABLE desde su creación (no existe evento de revisión); si se necesita editar borradores, debe añadirse
// un evento DOCUMENT_REVISED al fold, no un autoguardado simulado.
// GET (repositorio) — UN documento con su CONTENIDO real, adenda (append-only) y firma. Solo lectura, RLS-scoped.
const TYPE_UI:Record<string,string>={PROGRESS_NOTE:"Nota médica",DISCHARGE_SUMMARY:"Alta",REFERRAL:"Interconsulta",PROCEDURE_NOTE:"Procedimiento",OTHER:"Otro"};
const STATUS_ES:Record<string,string>={DRAFT:"Borrador",FINALIZED:"Finalizado",SIGNED:"Firmado",AMENDED:"Enmendado"};
export async function handleDocumentGet(req:Request,documentId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"document:read",purpose:"TREATMENT"});
  const d=await documentDetail(ctx,documentId);
  if(!d.exists)throw new ClinicalError("NOT_FOUND","Document not found");
  return NextResponse.json({...d,typeLabel:TYPE_UI[d.docType]??"Otro",statusLabel:STATUS_ES[d.state]??"Borrador"},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,documentId:string,requirePhysician:boolean){
 const{claims,ctx}=resolveVerified(req);
 const c=claims as Claims;
 authorize(principalFrom(c),requirePhysician?{role:"PHYSICIAN",scope:"document:write",purpose:"TREATMENT"}:{scope:"document:write",purpose:"TREATMENT"});
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldDocument(await readAggregateStream(ctx,AGG,documentId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Document not found");
 return{claims:c,ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,documentId:string,folded:FoldedDocument,to:DocumentState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string,extra:Record<string,unknown>={},guard?:()=>void){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:documentId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){
  // D7: TODA transición (no solo la firma) exige If-Match = versión leída antes de la máquina de estados.
  assertReadVersion("Document changed since last read",expectedVersion,folded.version);
  assertDocumentTransition(folded.state,to);guard?.();result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({documentId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed,...extra},{status:result.replayed?200:201});
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export const SignBody=z.object({occurredAt:z.string().datetime(),contentHash:z.string().regex(/^[0-9a-f]{64}$/,"contentHash must be a sha256 hex digest")});
export function documentContentHash(content:string):string{return crypto.createHash("sha256").update(content).digest("hex");}
// FINALIZE = DRAFT -> FINALIZED (contenido listo para firmar, distinct from draft save).
export async function handleDocumentFinalization(req:Request,documentId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,documentId,false);
  const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,documentId,folded,"FINALIZED","DOCUMENT_FINALIZED",{kind:"FINALIZED"},b.occurredAt,"document.finalized");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// SIGN = FINALIZED -> SIGNED. Physician Control + snapshot reproducible (contentHash del contenido).
// EXEC-0009: Solo un médico humano firma. La IA nunca firma el registro clínico-legal.
export async function handleDocumentSignature(req:Request,documentId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded,claims}=await loadForTransition(req,documentId,true);
  const b=await parseJson(req,SignBody);
  const contentHash=documentContentHash(folded.content);
  const cred=await physicianCredentials(ctx,claims); // L-05: identidad legal del firmante
  // Auditoría L-02: la hora de firma es la del SERVIDOR (la del cliente queda solo como dato forense). Auditoría L-03: el
  // cliente declara la huella del contenido que MUESTRA; si no coincide con lo persistido, no se firma.
  // R02a-DOC-02: mismo sello que el encuentro, construido en `clinical-signature` (antes eran dos copias divergentes) e
  // incluyendo la identidad legal del firmante dentro del hash.
  const payload=await replayStablePayload(ctx,idempotencyKey,documentId,b,()=>signedPayload({
   aggregateId:documentId,signedVersion:expectedVersion,contentHash,subject:claims.sub,
   signedAt:new Date().toISOString(),...(cred?{signer:cred}:{}),clientOccurredAt:b.occurredAt}));
  const signedAt=String(payload["signedAt"]);const signatureDigest=String(payload["signatureDigest"]);
  return await commit(ctx,idempotencyKey,expectedVersion,documentId,folded,"SIGNED","DOCUMENT_SIGNED",payload,signedAt,"document.signed",{signatureDigest,contentHash,signedAt},
   ()=>{if(b.contentHash!==contentHash)throw new ClinicalError("CONFLICT","El contenido en pantalla no coincide con el documento guardado (SIGNED_CONTENT_MISMATCH). Recargue el documento y revíselo antes de firmar.");
    assertPhysicianCredentials(cred);}); // L-05: sin cédula registrada no hay firma (428)
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// AMEND = {SIGNED,AMENDED} -> AMENDED. Addendum APPEND-ONLY; nunca modifica el snapshot firmado.
// PROD-022-R018: NUNCA borrar historial de firma/amendments. Cada corrección suma.
export const AmendBody=z.object({addendum:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleDocumentAmendment(req:Request,documentId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded,claims}=await loadForTransition(req,documentId,true);
  const b=await parseJson(req,AmendBody);
  return await commit(ctx,idempotencyKey,expectedVersion,documentId,folded,"AMENDED","DOCUMENT_AMENDED",{kind:"AMENDED",authorId:claims.sub,addendum:b.addendum,amendedAt:b.occurredAt},b.occurredAt,"document.amended");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// ===== Adjuntos binarios (PHI) en Vercel Blob PRIVADO =====
// El binario vive SOLO en el Blob store privado; en el event stream va únicamente la referencia (pathname del
// blob + hash + metadatos), coherente con el invariante "sin binarios en el event stream". La descarga se sirve
// SIEMPRE a través de una Function autorizada (nunca URL pública), verificando tenant + scope.
const MAX_ATTACHMENT_BYTES=25*1024*1024; // 25 MB
const ALLOWED_MIME=new Set(["application/pdf","image/png","image/jpeg","image/webp","image/gif","image/tiff"]);
const EXT_BY_MIME:Record<string,string>={"application/pdf":"pdf","image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif","image/tiff":"tif"};
// uuid determinista a partir de un texto (para que el reintento con el mismo Idempotency-Key sea idempotente).
const derivedUuid=(seed:string):string=>deterministicUuid(seed); // R01-015: una sola derivación en todo el repo
function safeName(name:string):string{return (name||"archivo").normalize("NFKD").replace(/[^\w.\-]+/g,"_").slice(0,80)||"archivo";}
function blobToken():string{const t=process.env.BLOB_READ_WRITE_TOKEN;if(!t)throw new ClinicalError("DEPENDENCY_UNAVAILABLE","Blob store no configurado (BLOB_READ_WRITE_TOKEN ausente)");return t;}

// POST /api/v1/documents/:id/attachments  (multipart/form-data: campo "file"). Sube el binario al Blob privado y
// registra el evento DOCUMENT_ATTACHED. No cambia el estado del documento (se puede adjuntar a un borrador o firmado).
export async function handleDocumentAttach(req:Request,documentId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  const c=claims as Claims;
  authorize(principalFrom(c),{scope:"document:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const detail=await documentDetail(ctx,documentId);
  if(!detail.exists)throw new ClinicalError("NOT_FOUND","Document not found");
  // Lee el archivo del multipart.
  const form=await req.formData().catch(()=>{throw new ClinicalError("VALIDATION_ERROR","multipart/form-data con campo 'file' requerido");});
  const file=form.get("file");
  if(!(file instanceof File))throw new ClinicalError("VALIDATION_ERROR","Campo 'file' ausente o inválido");
  const mime=file.type||"application/octet-stream";
  if(!ALLOWED_MIME.has(mime))throw new ClinicalError("VALIDATION_ERROR",`Tipo de archivo no permitido (${mime}). Permitidos: PDF, PNG, JPG, WEBP, GIF, TIFF`);
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.byteLength===0)throw new ClinicalError("VALIDATION_ERROR","Archivo vacío");
  if(bytes.byteLength>MAX_ATTACHMENT_BYTES)throw new ClinicalError("VALIDATION_ERROR",`Archivo demasiado grande (${bytes.byteLength} bytes; máx ${MAX_ATTACHMENT_BYTES})`);
  const contentHash=crypto.createHash("sha256").update(bytes).digest("hex");
  // Porte del hallazgo D6: replay ANTES de tocar el Blob (misma llave y mismo archivo -> la respuesta original; otro archivo ->
  // 409), subida a una ruta ÚNICA por intento (nunca sobrescribe) y limpieza segura; el flujo vive en `uploadThenCommit`
  // (lo comparte el perfil del médico). Antes: ruta determinista con allowOverwrite, y el catch borraba el blob que el
  // evento ya confirmado citaba cuando el reintento con la misma llave terminaba en IDEMPOTENCY_CONFLICT.
  const replay=async()=>{
   const prior=await priorCommand(ctx,{idempotencyKey,aggregateType:AGG,aggregateId:documentId,eventType:"DOCUMENT_ATTACHED",topic:"document.attached",at:"attachedAt"});
   if(!prior)return null;
   const p=prior.payload;if(p["contentHash"]!==contentHash)throw new ClinicalError("IDEMPOTENCY_CONFLICT","Idempotency-Key reused with a different request");
   return NextResponse.json({documentId,attachmentId:p["attachmentId"],filename:p["filename"],mime:p["mime"],size:p["size"],pathname:p["pathname"],contentHash,version:prior.version,auditHash:prior.auditHash,replayed:true},{status:200});
  };
  const attachmentId=derivedUuid(`${idempotencyKey}:${documentId}:attachment`);
  const filename=safeName(file.name);
  const pathname=`tenants/${c.tenantId}/documents/${documentId}/${attachmentId}-${crypto.randomUUID()}.${EXT_BY_MIME[mime]??"bin"}`; // aislada por tenant
  const occurredAt=new Date().toISOString();
  return await uploadThenCommit(ctx,{idempotencyKey,aggregateId:documentId,pathname,replay,
   upload:()=>put(pathname,Buffer.from(bytes),{access:"private",token:blobToken(),contentType:mime,addRandomSuffix:false,allowOverwrite:false}),
   discard:()=>del(pathname,{token:blobToken()}),
   commit:async()=>{
    const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:documentId,expectedVersion:detail.version,eventType:"DOCUMENT_ATTACHED",payload:{kind:"ATTACHED",attachmentId,filename,mime,size:bytes.byteLength,pathname,contentHash,authorId:c.sub,attachedAt:occurredAt},occurredAt,topic:"document.attached"});
    const result=await runClinicalCommand(ctx,cmd);
    const r=result.response as{version:number;auditHash?:string};
    return NextResponse.json({documentId,attachmentId,filename,mime,size:bytes.byteLength,pathname,contentHash,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
   }});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// GET /api/v1/documents/:id/attachments/:attachmentId  -> descarga el binario a través de la Function (privado).
export async function handleDocumentDownload(req:Request,documentId:string,attachmentId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"document:read",purpose:"TREATMENT"});
  const detail=await documentDetail(ctx,documentId);
  if(!detail.exists)throw new ClinicalError("NOT_FOUND","Document not found");
  const att=detail.attachments.find(a=>a.attachmentId===attachmentId);
  if(!att)throw new ClinicalError("NOT_FOUND","Attachment not found");
  const res=await get(att.pathname,{access:"private",token:blobToken()});
  if(!res||res.statusCode!==200||!res.stream)throw new ClinicalError("NOT_FOUND","Attachment blob not found");
  return new Response(res.stream,{status:200,headers:{"content-type":att.mime,"content-disposition":`inline; filename="${att.filename}"`,"cache-control":"private, no-store"}});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// DELETE /api/v1/documents/:id/attachments/:attachmentId  -> quita un adjunto (borra el blob y registra
// ATTACHMENT_REMOVED, APPEND-ONLY: el historial del evento queda; solo desaparece de la lista y del store).
export async function handleDocumentAttachmentRemove(req:Request,documentId:string,attachmentId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  const c=claims as Claims;
  authorize(principalFrom(c),{scope:"document:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const detail=await documentDetail(ctx,documentId);
  if(!detail.exists)throw new ClinicalError("NOT_FOUND","Document not found");
  // Porte del hallazgo D6: un reintento de una retirada ya aplicada responde la original (antes: 404, el adjunto ya no figuraba
  // en documentDetail, y la hora del servidor en el hash impedía el replay).
  const prior=await priorCommand(ctx,{idempotencyKey,aggregateType:AGG,aggregateId:documentId,eventType:"DOCUMENT_ATTACHMENT_REMOVED",topic:"document.attachment_removed",at:"removedAt"});
  if(prior){
   if(prior.payload["attachmentId"]!==attachmentId)throw new ClinicalError("IDEMPOTENCY_CONFLICT","Idempotency-Key reused with a different request");
   // El reintento REPITE el borrado del binario (idempotente): si falló tras el evento, el PHI no queda en el almacén.
   const cited=(await readAggregateStream(ctx,AGG,documentId)).find(e=>e.payload["kind"]==="ATTACHED"&&e.payload["attachmentId"]===attachmentId)?.payload["pathname"];
   if(typeof cited==="string")await del(cited,{token:blobToken()}).catch(()=>{/* ya pudo no existir */});
   return NextResponse.json({documentId,attachmentId,removed:true,version:prior.version,auditHash:prior.auditHash,replayed:true},{status:200});
  }
  const att=detail.attachments.find(a=>a.attachmentId===attachmentId);
  if(!att)throw new ClinicalError("NOT_FOUND","Attachment not found");
  const occurredAt=new Date().toISOString();
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:documentId,expectedVersion:detail.version,eventType:"DOCUMENT_ATTACHMENT_REMOVED",payload:{kind:"ATTACHMENT_REMOVED",attachmentId,authorId:c.sub,removedAt:occurredAt},occurredAt,topic:"document.attachment_removed"});
  const result=await runClinicalCommand(ctx,cmd);
  // borra el binario del store (mejor esfuerzo; el evento es la fuente de verdad)
  await del(att.pathname,{token:blobToken()}).catch(()=>{/* ya pudo no existir */});
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({documentId,attachmentId,removed:true,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
