import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldDocument,assertDocumentTransition,type FoldedDocument,type DocumentState}from"../../../packages/document-fold/src";
import{put,del,get}from"@vercel/blob";
import{runClinicalCommand,lookupReplay,readAggregateEvents,documentDetail}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC I — Ciclo de vida del documento clínico sobre el kernel. Autoridad PROD-014-R022 /
// PROD-022-R018: la firma produce un snapshot reproducible (contentHash) y las correcciones son
// addendum/amendment APPEND-ONLY; nunca se borra el historial. Physician Control: solo un médico
// humano firma y enmienda (la IA nunca firma el registro clínico-legal).
// EXEC-0009: Draft save y clinical/legal signature son operaciones DISTINTAS. Autosave NUNCA
// masquerade como signature. Encuentro: planned -> arrived -> in_progress -> ready_for_review -> signed -> amended -> closed.
const AGG="ClinicalDocument";
type Claims={sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string};

const CreateBody=z.object({documentId:z.string().uuid(),patientId:z.string().uuid(),encounterId:z.string().uuid().optional(),docType:z.enum(["PROGRESS_NOTE","DISCHARGE_SUMMARY","REFERRAL","PROCEDURE_NOTE","OTHER"]),title:z.string().min(1),content:z.string().min(1),occurredAt:z.string().datetime()});
// CREATE = borrador (draft). Cualquier clínico con scope document:write.
// NO es el registro firmado. Draft save != signature (EXEC-0009).
export async function handleDocumentCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"document:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.documentId,expectedVersion:0,eventType:"DOCUMENT_CREATED",payload:{kind:"CREATED",patientId:b.patientId,encounterId:b.encounterId,docType:b.docType,title:b.title,content:b.content},occurredAt:b.occurredAt,topic:"document.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({documentId:b.documentId,state:"DRAFT",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// AUTOSAVE (draft persist) - NO crea evento en event store, solo actualiza contenido local.
// EXEC-0009: Autosave must never masquerade as signature.
const AutosaveBody=z.object({documentId:z.string().uuid(),content:z.string().min(1),title:z.string().optional(),occurredAt:z.string().datetime()});
export async function handleDocumentAutosave(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"document:write",purpose:"TREATMENT"});
  const b=await parseJson(req,AutosaveBody);
  // Autosave NO va a event store. Solo actualiza proyección local/cliente.
  // El contenido definitivo se persiste en FINALIZE o SIGN.
  const contentHash=crypto.createHash("sha256").update(b.content).digest("hex");
  return NextResponse.json({documentId:b.documentId,contentHash,autosavedAt:b.occurredAt,note:"AUTOSAVE_ONLY_NO_EVENT"},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// GET (repositorio) — UN documento con su CONTENIDO real, adenda (append-only) y firma. Solo lectura, RLS-scoped.
const TYPE_UI:Record<string,string>={PROGRESS_NOTE:"Nota médica",DISCHARGE_SUMMARY:"Alta",REFERRAL:"Interconsulta",PROCEDURE_NOTE:"Procedimiento",OTHER:"Otro"};
const STATUS_ES:Record<string,string>={DRAFT:"Borrador",FINALIZED:"Finalizado",SIGNED:"Firmado",AMENDED:"Enmendado"};
export async function handleDocumentGet(req:Request,documentId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"document:write",purpose:"TREATMENT"});
  const d=await documentDetail(ctx,documentId);
  if(!d.exists)throw new ClinicalError("NOT_FOUND","Document not found");
  return NextResponse.json({...d,typeLabel:TYPE_UI[d.docType]??"Otro",statusLabel:STATUS_ES[d.state]??"Borrador"},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,documentId:string,requirePhysician:boolean){
 const{claims,ctx}=resolveVerified(req);
 const c=claims as Claims;
 authorize(principalFrom(c),requirePhysician?{tenantId:c.tenantId,role:"PHYSICIAN",scope:"document:write",purpose:"TREATMENT"}:{tenantId:c.tenantId,scope:"document:write",purpose:"TREATMENT"});
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldDocument(await readAggregateEvents(ctx,documentId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Document not found");
 return{claims:c,ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,documentId:string,folded:FoldedDocument,to:DocumentState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string,extra:Record<string,unknown>={}){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:documentId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertDocumentTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({documentId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed,...extra},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});
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
  const b=await parseJson(req,WhenBody);
  const contentHash=crypto.createHash("sha256").update(folded.content).digest("hex");
  const signatureDigest=crypto.createHash("sha256").update(`${documentId}:${expectedVersion}:${contentHash}:${claims.sub}:${b.occurredAt}`).digest("hex");
  return await commit(ctx,idempotencyKey,expectedVersion,documentId,folded,"SIGNED","DOCUMENT_SIGNED",{kind:"SIGNED",authorId:claims.sub,contentHash,signatureDigest,signedAt:b.occurredAt},b.occurredAt,"document.signed",{signatureDigest,contentHash});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// AMEND = {SIGNED,AMENDED} -> AMENDED. Addendum APPEND-ONLY; nunca modifica el snapshot firmado.
// PROD-022-R018: NUNCA borrar historial de firma/amendments. Cada corrección suma.
const AmendBody=z.object({addendum:z.string().min(1),occurredAt:z.string().datetime()});
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
function derivedUuid(seed:string):string{const h=crypto.createHash("sha256").update(seed).digest("hex");return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
function safeName(name:string):string{return (name||"archivo").normalize("NFKD").replace(/[^\w.\-]+/g,"_").slice(0,80)||"archivo";}
function blobToken():string{const t=process.env.BLOB_READ_WRITE_TOKEN;if(!t)throw new ClinicalError("DEPENDENCY_UNAVAILABLE","Blob store no configurado (BLOB_READ_WRITE_TOKEN ausente)");return t;}

// POST /api/v1/documents/:id/attachments  (multipart/form-data: campo "file"). Sube el binario al Blob privado y
// registra el evento DOCUMENT_ATTACHED. No cambia el estado del documento (se puede adjuntar a un borrador o firmado).
export async function handleDocumentAttach(req:Request,documentId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  const c=claims as Claims;
  authorize(principalFrom(c),{tenantId:c.tenantId,scope:"document:write",purpose:"TREATMENT"});
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
  const attachmentId=derivedUuid(`${idempotencyKey}:${documentId}:attachment`);
  const filename=safeName(file.name);
  // Aislamiento por tenant en la ruta del blob; nombre determinista para idempotencia del reintento.
  const pathname=`tenants/${c.tenantId}/documents/${documentId}/${attachmentId}.${EXT_BY_MIME[mime]??"bin"}`;
  const occurredAt=new Date().toISOString();
  // Sube PRIMERO al blob (privado, sin sufijo aleatorio para que el reintento sobrescriba la misma ruta).
  await put(pathname,Buffer.from(bytes),{access:"private",token:blobToken(),contentType:mime,addRandomSuffix:false,allowOverwrite:true});
  // Luego registra el evento. Si el commit falla, borra el blob para no dejar huérfanos.
  try{
   const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:documentId,expectedVersion:detail.version,eventType:"DOCUMENT_ATTACHED",payload:{kind:"ATTACHED",attachmentId,filename,mime,size:bytes.byteLength,pathname,contentHash,authorId:c.sub,attachedAt:occurredAt},occurredAt,topic:"document.attached"});
   let result=await lookupReplay(ctx,cmd);
   if(!result)result=await runClinicalCommand(ctx,cmd);
   const r=result.response as{version:number;auditHash?:string};
   return NextResponse.json({documentId,attachmentId,filename,mime,size:bytes.byteLength,pathname,contentHash,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
  }catch(commitErr){
   // rollback del binario: el evento no se registró, el blob no debe quedar
   await del(pathname,{token:blobToken()}).catch(()=>{/* mejor esfuerzo; no enmascarar el error original */});
   throw commitErr;
  }
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// GET /api/v1/documents/:id/attachments/:attachmentId  -> descarga el binario a través de la Function (privado).
export async function handleDocumentDownload(req:Request,documentId:string,attachmentId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"document:write",purpose:"TREATMENT"});
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
  authorize(principalFrom(c),{tenantId:c.tenantId,scope:"document:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const detail=await documentDetail(ctx,documentId);
  if(!detail.exists)throw new ClinicalError("NOT_FOUND","Document not found");
  const att=detail.attachments.find(a=>a.attachmentId===attachmentId);
  if(!att)throw new ClinicalError("NOT_FOUND","Attachment not found");
  const occurredAt=new Date().toISOString();
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:documentId,expectedVersion:detail.version,eventType:"DOCUMENT_ATTACHMENT_REMOVED",payload:{kind:"ATTACHMENT_REMOVED",attachmentId,authorId:c.sub,removedAt:occurredAt},occurredAt,topic:"document.attachment_removed"});
  let result=await lookupReplay(ctx,cmd);
  if(!result)result=await runClinicalCommand(ctx,cmd);
  // borra el binario del store (mejor esfuerzo; el evento es la fuente de verdad)
  await del(att.pathname,{token:blobToken()}).catch(()=>{/* ya pudo no existir */});
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({documentId,attachmentId,removed:true,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
