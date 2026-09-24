// ⚠️ NOT_WIRED (endurecimiento G / Epic BF): este handler NO está cableado a ninguna ruta (código inalcanzable).
// Ver docs/adjudication/not-wired-registry.json. R6 (IA) EN PAUSA: no activar. No cuenta como capacidad end-to-end.
import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{computeHash,createQuarantineKey,createStorageKey,generateDocumentId,classifyDocument,extractStructuredData,validateExtraction,buildClinicalObjects,createProvenanceLinks,type DocumentMetadata,type DocumentIngestionStatus}from"../../../packages/document-ingestion/src";
// EPIC K — Document Ingestion Pipeline (EXEC-0018).
// upload -> authorization -> quarantine -> malware scanning -> hash -> private object storage
// -> metadata -> classification -> extraction/OCR if needed -> candidate structured data
// -> validation/reconciliation -> authoritative structured objects -> provenance links to original.
// The original remains immutable. Extracted data preserves document/page/source references.
// Do not automatically transform extraction into clinical truth without the required validation path.
// Use short-lived signed URLs or authorized proxy; never public PHI URLs.

const AGG="DocumentIngestion";

function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string},requirePhysician=false){
 const opts:{role?:string;scope:string;purpose?:string}={scope:"document:write",purpose:"TREATMENT"};
 if(requirePhysician)opts.role="PHYSICIAN";
 authorize(principalFrom(claims),opts);
}

const UploadBody=z.object({patientId:z.string().uuid(),encounterId:z.string().uuid().optional(),mimeType:z.string().min(1),sizeBytes:z.number().int().positive().max(50_000_000),filename:z.string().min(1)});

// Helper to assert non-null and return value
function ensureString(val:string|undefined,field:string):string{
 if(val===undefined)throw new ClinicalError("VALIDATION_ERROR",`${field} is required`);
 return val;
}

/*
export async function handleDocumentUploadInit(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims);
  const b=await parseJson(req,UploadBody)as{patientId:string;encounterId?:string;mimeType:string;sizeBytes:number;filename:string};
  // Validar MIME type inline to avoid type issues
  const mimeTypeValue:string=ensureString(b.mimeType,"mimeType");
  const allowedTypes=["application/pdf","image/jpeg","image/png","image/tiff","application/dicom","text/plain","application/rtf"];
  const mimeValid={valid:allowedTypes.includes(mimeTypeValue),error:allowedTypes.includes(mimeTypeValue)?undefined:`MIME type ${mimeTypeValue} not allowed`};
  if(!mimeValid.valid)throw new ClinicalError("VALIDATION_ERROR",mimeValid.error??"MIME type validation failed");
  // Generar documentId y crear metadata inicial
  const documentId=generateDocumentId();
  const quarantineKey=createQuarantineKey(documentId);
  const metadata:DocumentMetadata={
   documentId,
   tenantId:claims.tenantId,
   patientId:b.patientId,
   encounterId:b.encounterId??undefined,
   uploadedBy:claims.sub,
   originalFilename:b.filename,
   mimeType:b.mimeType,
   sizeBytes:b.sizeBytes,
   sha256:"",
   uploadStatus:"PENDING",
   scanStatus:"PENDING",
   provenance:[{type:"ORIGINAL_DOCUMENT",documentId}],
  };
  // Crear evento inicial en agregado
  const idempotencyKey=req.headers.get("idempotency-key")??crypto.randomUUID();
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:documentId,expectedVersion:0,eventType:"DOCUMENT_UPLOAD_INIT",payload:{kind:"UPLOAD_INIT",metadata},occurredAt:new Date().toISOString(),topic:"document.upload_init"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  // Retornar info para upload directo a object storage (presigned URL en producción)
  return NextResponse.json({documentId,quarantineKey,storageKey:createStorageKey(documentId),uploadUrl:`/api/upload/${documentId}`,metadata},{status:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
*/

export async function handleDocumentUploadInit(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims);
  const b=await parseJson(req,UploadBody)as{patientId:string;encounterId?:string;mimeType:string;sizeBytes:number;filename:string};
  // Validar MIME type inline to avoid type issues
  const mimeTypeValue:string=ensureString(b.mimeType,"mimeType");
  const allowedTypes=["application/pdf","image/jpeg","image/png","image/tiff","application/dicom","text/plain","application/rtf"];
  const mimeValid={valid:allowedTypes.includes(mimeTypeValue),error:allowedTypes.includes(mimeTypeValue)?undefined:`MIME type ${mimeTypeValue} not allowed`};
  if(!mimeValid.valid)throw new ClinicalError("VALIDATION_ERROR",mimeValid.error??"MIME type validation failed");
  // Generar documentId y crear metadata inicial
  const documentId=generateDocumentId();
  const quarantineKey=createQuarantineKey(documentId);
  const metadata:DocumentMetadata={
   documentId,
   tenantId:claims.tenantId,
   patientId:b.patientId,
   encounterId:b.encounterId??undefined,
   uploadedBy:claims.sub,
   originalFilename:b.filename,
   mimeType:b.mimeType,
   sizeBytes:b.sizeBytes,
   sha256:"",
   uploadStatus:"PENDING",
   scanStatus:"PENDING",
   provenance:[{type:"ORIGINAL_DOCUMENT",documentId}],
  };
  // Crear evento inicial en agregado
  const idempotencyKey=req.headers.get("idempotency-key")??crypto.randomUUID();
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:documentId,expectedVersion:0,eventType:"DOCUMENT_UPLOAD_INIT",payload:{kind:"UPLOAD_INIT",metadata},occurredAt:new Date().toISOString(),topic:"document.upload_init"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  // Retornar info para upload directo a object storage (presigned URL en producción)
  return NextResponse.json({documentId,quarantineKey,storageKey:createStorageKey(documentId),uploadUrl:`/api/upload/${documentId}`,metadata},{status:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const UploadCompleteBody=z.object({documentId:z.string().uuid(),sha256:z.string().length(64),sizeBytes:z.number().int().positive()});

export async function handleDocumentUploadComplete(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,UploadCompleteBody);
  // Verificar hash del archivo subido
  // En producción: verificar contra object storage
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.documentId,expectedVersion:1,eventType:"DOCUMENT_UPLOADED",payload:{kind:"UPLOADED",sha256:b.sha256,sizeBytes:b.sizeBytes,uploadStatus:"COMPLETE",scanStatus:"PENDING"},occurredAt:new Date().toISOString(),topic:"document.uploaded"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  // Auditoría 2026-09-19 (L-14): aquí se "simulaba" el antivirus grabando un evento SCAN_COMPLETE con
  // {scanStatus:"CLEAN", engine:"clamav"} que ningún motor había producido: una verificación falsa en el registro
  // inmutable. No existe escáner desplegado; el documento queda SCAN_PENDING y solo un escáner real (que reciba el
  // binario y firme su resultado) podrá registrar SCAN_COMPLETE. Fail-closed: nada aguas abajo trata PENDING como limpio.
  return NextResponse.json({documentId:b.documentId,status:"SCAN_PENDING",scanStatus:"PENDING",version:r.version,note:"Sin escáner de malware desplegado: el documento no se considera limpio"},{status:202});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const ClassifyBody=z.object({documentId:z.string().uuid(),extractedText:z.string().optional()});

export async function handleDocumentClassify(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"document:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ClassifyBody);
  // En producción: leer metadata del agregado
  const extractedText=b.extractedText??"";
  const classification=classifyDocument("application/pdf",extractedText);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.documentId,expectedVersion:2,eventType:"DOCUMENT_CLASSIFIED",payload:{kind:"CLASSIFIED",classification},occurredAt:new Date().toISOString(),topic:"document.classified"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({documentId:b.documentId,classification,version:r.version},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const ExtractBody=z.object({documentId:z.string().uuid(),extractedText:z.string().min(1),documentType:z.enum(["LAB_REPORT","IMAGING_REPORT","DISCHARGE_SUMMARY","REFERRAL","PROGRESS_NOTE","CONSENT","INSURANCE","OTHER"]).default("OTHER")});

export async function handleDocumentExtract(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"document:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ExtractBody);
  const {extractStructuredData,validateExtraction,buildClinicalObjects,createProvenanceLinks}=await import("../../../packages/document-ingestion/src");
  // Extraer datos estructurados
  const extractedFields=extractStructuredData(b.extractedText,b.documentType);
  const validation=validateExtraction(extractedFields,b.documentType);
  if(!validation.valid)throw new ClinicalError("VALIDATION_ERROR",`Extraction validation failed: ${validation.errors.join("; ")}`);
  // Construir objetos clínicos
  // L-14: la extracción no afirma un escaneo limpio que no ocurrió; los metadatos reales vendrían del stream del documento.
  const metadata:DocumentMetadata={documentId:b.documentId,tenantId:"",patientId:"",uploadedBy:"",originalFilename:"",mimeType:"",sizeBytes:0,sha256:"",uploadStatus:"COMPLETE",scanStatus:"PENDING",provenance:[]};
  const clinicalObjects=buildClinicalObjects(extractedFields,b.documentType,metadata);
  const provenance=createProvenanceLinks(b.documentId,extractedFields);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.documentId,expectedVersion:3,eventType:"DOCUMENT_EXTRACTED",payload:{kind:"EXTRACTED",extractedFields,clinicalObjects,provenance,extractionStatus:"COMPLETE"},occurredAt:new Date().toISOString(),topic:"document.extracted"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({documentId:b.documentId,extractedFields,clinicalObjects,provenance,version:r.version},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const ValidateBody=z.object({documentId:z.string().uuid(),approve:z.boolean(),notes:z.string().optional()});

export async function handleDocumentValidate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{role:"PHYSICIAN",scope:"document:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ValidateBody);
  if(!b.approve)throw new ClinicalError("VALIDATION_ERROR","Document not approved for clinical integration");
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.documentId,expectedVersion:4,eventType:"DOCUMENT_RECONCILED",payload:{kind:"RECONCILED",approvedBy:claims.sub,notes:b.notes},occurredAt:new Date().toISOString(),topic:"document.reconciled"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({documentId:b.documentId,status:"RECONCILED",version:r.version},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}