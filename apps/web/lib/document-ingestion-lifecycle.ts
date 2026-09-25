// ⚠️ NOT_WIRED (endurecimiento G / Epic BF): este handler NO está cableado a ninguna ruta (código inalcanzable).
// Ver docs/adjudication/not-wired-registry.json. R6 (IA) EN PAUSA: no activar. No cuenta como capacidad end-to-end.
import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,patientDemographics}from"./clinical-runtime";
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

/**
 * Auditoría R02b (R2B-014, lote 17) — la metadata del documento SE LEE del agregado.
 *
 * `readAggregateEvents` estaba importado en este archivo y no se invocaba en ninguna línea; los handlers construían la
 * metadata con todos los campos de identidad vacíos. Esto la recupera del evento `UPLOAD_INIT`, que es donde el propio
 * pipeline la escribió, y falla si el documento no existe en el tenant: un 404 explícito en vez de seguir con ceros.
 */
async function leerMetadata(ctx:Parameters<typeof readAggregateEvents>[0],documentId:string):Promise<DocumentMetadata>{
 const eventos=await readAggregateEvents(ctx,documentId);
 const init=eventos.find(e=>e.payload["kind"]==="UPLOAD_INIT");
 const meta=init?.payload["metadata"];
 if(!meta||typeof meta!=="object")throw new ClinicalError("NOT_FOUND","Document not found");
 // Las transiciones posteriores completan campos (sha256 y tamaño llegan con UPLOADED): se superponen en orden.
 const subido=eventos.find(e=>e.payload["kind"]==="UPLOADED")?.payload??{};
 const base=meta as DocumentMetadata;
 return{...base,
  ...(typeof subido["sha256"]==="string"?{sha256:subido["sha256"] as string}:{}),
  ...(typeof subido["sizeBytes"]==="number"?{sizeBytes:subido["sizeBytes"] as number}:{})};
}

// Helper to assert non-null and return value
function ensureString(val:string|undefined,field:string):string{
 if(val===undefined)throw new ClinicalError("VALIDATION_ERROR",`${field} is required`);
 return val;
}

// Auditoría R02b (R2B-015, lote 17): aquí vivían 38 líneas comentadas que duplicaban EXACTAMENTE la función viva de
// abajo. Una copia comentada de código vivo es ruido que envejece: en el primer cambio, las dos versiones dicen cosas
// distintas y quien lee el diff no sabe cuál manda. Se retira; el historial de git ya la conserva.

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
  // Auditoría R02b (R2B-012, lote 20): esto devolvía `uploadUrl:"/api/upload/<id>"`, una ruta que NO EXISTE en
  // `apps/web/app/api`, y dos claves de almacenamiento que solo son cadenas: no hay cliente de object storage en el
  // repositorio (ni Vercel Blob, ni S3, ni GCS, ni multipart). Prometer una URL de subida a la que el navegador no puede
  // subir nada es la forma más directa de que el cliente crea que el pipeline existe. Se dice lo que hay: las claves están
  // reservadas y el almacenamiento está SIN DECIDIR, que es una decisión del dueño (R2B-012, ADR pendiente).
  return NextResponse.json({documentId,quarantineKey,storageKey:createStorageKey(documentId),
   upload:{available:false,reason:"OBJECT_STORAGE_NOT_CONFIGURED",
    note:"No hay almacenamiento de binarios configurado: estas claves están reservadas, pero todavía no existe un destino al que subir el archivo. Decidir el backend (Vercel Blob u objeto S3-compatible con cifrado en reposo) es requisito para activar la ingesta documental."},
   metadata},{status:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const UploadCompleteBody=z.object({documentId:z.string().uuid(),sha256:z.string().length(64),sizeBytes:z.number().int().positive()});

export async function handleDocumentUploadComplete(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims);
  const{idempotencyKey,expectedVersion}=requireMutationHeaders(req); // R2B-010: la versión la aporta el cliente
  const b=await parseJson(req,UploadCompleteBody);
  // Verificar hash del archivo subido
  // En producción: verificar contra object storage
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.documentId,expectedVersion,eventType:"DOCUMENT_UPLOADED",payload:{kind:"UPLOADED",sha256:b.sha256,sizeBytes:b.sizeBytes,uploadStatus:"COMPLETE",scanStatus:"PENDING"},occurredAt:new Date().toISOString(),topic:"document.uploaded"});
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
  // R2B-010: la versión esperada la APORTA EL CLIENTE en `If-Match`, como en el resto del repositorio. Estaba escrita a mano
  // (`expectedVersion:2`), lo que además de romperse con cualquier evento intermedio hacía imposible la concurrencia
  // optimista: dos clasificaciones simultáneas mandaban el mismo número y la segunda no sabía contra qué había chocado.
  const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
  const b=await parseJson(req,ClassifyBody);
  // El MIME real viene del agregado, no de un literal: clasificar un PDF suponiendo que todo es PDF es adivinar.
  const meta=await leerMetadata(ctx,b.documentId);
  const extractedText=b.extractedText??"";
  const classification=classifyDocument(meta.mimeType||"application/pdf",extractedText);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.documentId,expectedVersion,eventType:"DOCUMENT_CLASSIFIED",payload:{kind:"CLASSIFIED",classification},occurredAt:new Date().toISOString(),topic:"document.classified"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({documentId:b.documentId,classification,version:r.version},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// Auditoría R02b (R2B-013, lote 20) — AQUÍ NO HAY OCR, Y EL NOMBRE DEL CAMPO LO DICE.
//
// El anexo preguntó si la «extracción» hace OCR: no. Este endpoint recibe el TEXTO YA TRANSCRITO en el cuerpo JSON —alguien
// convirtió antes la imagen o el PDF— y sobre él corre cuatro expresiones regulares en español. Nunca ve el binario. La
// respuesta honesta no es renombrar el epic: es que el contrato diga qué espera, para que nadie mande un PDF creyendo que
// esto lo lee. `extractedText` se mantiene como nombre del campo porque es exactamente lo que es.
const ExtractBody=z.object({documentId:z.string().uuid(),extractedText:z.string().min(1),documentType:z.enum(["LAB_REPORT","IMAGING_REPORT","DISCHARGE_SUMMARY","REFERRAL","PROGRESS_NOTE","CONSENT","INSURANCE","OTHER"]).default("OTHER")});

export async function handleDocumentExtract(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"document:write",purpose:"TREATMENT"});
  const{idempotencyKey,expectedVersion}=requireMutationHeaders(req); // R2B-010: la versión la aporta el cliente
  const b=await parseJson(req,ExtractBody);
  const {extractStructuredData,validateExtraction,buildClinicalObjects,createProvenanceLinks}=await import("../../../packages/document-ingestion/src");
  // Extraer datos estructurados
  const extractedFields=extractStructuredData(b.extractedText,b.documentType);
  const validation=validateExtraction(extractedFields,b.documentType);
  if(!validation.valid)throw new ClinicalError("VALIDATION_ERROR",`Extraction validation failed: ${validation.errors.join("; ")}`);
  // Auditoría R02b (R2B-014, lote 17) — LA METADATA ESTABA VACÍA POR CÓDIGO, no por falta de datos.
  //
  // Aquí se construía `{tenantId:"",patientId:"",uploadedBy:"",sha256:"",...}` y con ella se armaban los «objetos clínicos
  // autoritativos»: un resultado de laboratorio SIN PACIENTE. `readAggregateEvents` estaba importado y jamás se llamaba.
  // Ahora la metadata se LEE del agregado, que es donde el propio pipeline la escribió al iniciar la subida.
  const metadata=await leerMetadata(ctx,b.documentId);
  // Y la barrera que faltaba: el nombre que la extracción encuentra en el documento se compara contra el del paciente
  // REGISTRADO bajo ese `patientId`. Un documento de otro paciente subido al expediente equivocado no disparaba ninguna
  // alerta, y es uno de los errores de identificación más comunes en la práctica. No se bloquea en silencio ni se ignora:
  // se rechaza diciendo qué nombre trae el documento y a qué expediente se está adjuntando.
  const nombreEnDocumento=extractedFields.find(f=>f.fieldName==="patient_name")?.value;
  if(nombreEnDocumento&&metadata.patientId){
   const demo=await patientDemographics(ctx,metadata.patientId);
   const norm=(x:string)=>x.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
   if(demo?.name&&norm(demo.name)!==norm(String(nombreEnDocumento)))
    throw new ClinicalError("VALIDATION_ERROR",
     "El nombre que aparece en el documento no coincide con el del paciente del expediente: no se adjunta sin resolverlo.",
     {mismatch:"PATIENT_NAME",inDocument:String(nombreEnDocumento)});
  }
  const clinicalObjects=buildClinicalObjects(extractedFields,b.documentType,metadata);
  const provenance=createProvenanceLinks(b.documentId,extractedFields);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.documentId,expectedVersion,eventType:"DOCUMENT_EXTRACTED",payload:{kind:"EXTRACTED",extractedFields,clinicalObjects,provenance,extractionStatus:"COMPLETE"},occurredAt:new Date().toISOString(),topic:"document.extracted"});
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
  const{idempotencyKey,expectedVersion}=requireMutationHeaders(req); // R2B-010: la versión la aporta el cliente
  const b=await parseJson(req,ValidateBody);
  if(!b.approve)throw new ClinicalError("VALIDATION_ERROR","Document not approved for clinical integration");
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.documentId,expectedVersion,eventType:"DOCUMENT_RECONCILED",payload:{kind:"RECONCILED",approvedBy:claims.sub,notes:b.notes},occurredAt:new Date().toISOString(),topic:"document.reconciled"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({documentId:b.documentId,status:"RECONCILED",version:r.version},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}