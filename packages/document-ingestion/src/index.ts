// EPIC K — Document Ingestion Pipeline (EXEC-0018).
// upload -> authorization -> quarantine -> malware scanning -> hash -> private object storage
// -> metadata -> classification -> extraction/OCR if needed -> candidate structured data
// -> validation/reconciliation -> authoritative structured objects -> provenance links to original.
// The original remains immutable. Extracted data preserves document/page/source references.
// Do not automatically transform extraction into clinical truth without the required validation path.
// Use short-lived signed URLs or authorized proxy; never public PHI URLs.
// Autoridad: PROD (documentos clínicos), CAP-DOCUMENT-INGESTION-001.

import crypto from "node:crypto";

export type DocumentIngestionStatus="UPLOADED"|"QUARANTINED"|"SCANNING"|"SCAN_CLEAN"|"SCAN_INFECTED"|"CLASSIFIED"|"EXTRACTING"|"EXTRACTED"|"VALIDATING"|"RECONCILED"|"REJECTED"|"ARCHIVED";

export type DocumentMetadata=Readonly<{
  documentId:string;
  tenantId:string;
  patientId:string;
  encounterId?:string|undefined;
  uploadedBy:string;
  originalFilename:string;
  mimeType:string;
  sizeBytes:number;
  sha256:string;
  uploadStatus:"PENDING"|"COMPLETE"|"FAILED";
  scanStatus:"PENDING"|"CLEAN"|"INFECTED"|"ERROR";
  classification?:DocumentClassification;
  extractionStatus?:ExtractionStatus;
  provenance:ProvenanceLink[];
}>;

export type DocumentClassification=Readonly<{
  documentType:"LAB_REPORT"|"IMAGING_REPORT"|"DISCHARGE_SUMMARY"|"REFERRAL"|"PROGRESS_NOTE"|"CONSENT"|"INSURANCE"|"OTHER";
  confidence:number; // 0-100
  pageCount:number;
  language:string;
}>;

export type ExtractionStatus=Readonly<{
  status:"PENDING"|"IN_PROGRESS"|"COMPLETE"|"FAILED"|"SKIPPED";
  extractedFields:ExtractedField[];
  rawText?:string;
  pageTexts?:string[];
}>;

export type ExtractedField=Readonly<{
  fieldName:string;
  value:string;
  confidence:number; // 0-100
  pageNumber:number;
  sourceRef:string; // page/line reference
}>;

export type ProvenanceLink=Readonly<{
  type:"ORIGINAL_DOCUMENT"|"PAGE"|"LINE"|"EXTRACTION";
  documentId:string;
  pageNumber?:number;
  lineNumber?:number;
  hash?:string;
  sourceRef?:string;
}>;

// Pipeline stages as pure functions (deterministic)

export function computeHash(buffer:Buffer):string{
 return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function validateMimeType(mimeType:string|undefined,buffer:Buffer):{valid:boolean;error?:string}{
 // Basic MIME validation - in production use libmagic/file-type
 const allowedTypes=[
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "application/dicom",
  "text/plain",
  "application/rtf",
 ];
 if(!mimeType||!allowedTypes.includes(mimeType)){
  return{valid:false,error:mimeType?`MIME type ${mimeType} not allowed`:"MIME type is required"};
 }
 // Optional: magic bytes validation for PDF (%PDF), JPEG (FF D8 FF), PNG (89 50 4E 47)
 return{valid:true};
}

export function createQuarantineKey(documentId:string):string{
 return `quarantine/${documentId}/${Date.now()}`;
}

export function createStorageKey(documentId:string):string{
 return `documents/${documentId}/${Date.now()}`;
}

export function generateDocumentId():string{
 return crypto.randomUUID();
}

// Classification rules (simplified - in production use ML/classifier)
export function classifyDocument(mimeType:string,extractedText?:string):DocumentClassification{
 const text=(extractedText??"").toLowerCase();
 let documentType:DocumentClassification["documentType"]="OTHER";
 let confidence=30;
 if(text.includes("laboratorio")||text.includes("hemograma")||text.includes("bioquímica")||text.includes("resultados de laboratorio")){
  documentType="LAB_REPORT";confidence=85;
 }else if(text.includes("radiograf")||text.includes("tomograf")||text.includes("resonancia")||text.includes("ecograf")||text.includes("imagen")){
  documentType="IMAGING_REPORT";confidence=85;
 }else if(text.includes("alta hospital")||text.includes("resumen de alta")||text.includes("epicrisis")){
  documentType="DISCHARGE_SUMMARY";confidence=80;
 }else if(text.includes("interconsulta")||text.includes("derivación")||text.includes("referencia")){
  documentType="REFERRAL";confidence=80;
 }else if(text.includes("consentimiento")||text.includes("firma")){
  documentType="CONSENT";confidence=75;
 }
 return{documentType,confidence,pageCount:1,language:"es"};
}

// Extraction simulation (in production: OCR + NLP)
export function extractStructuredData(text:string,documentType:DocumentClassification["documentType"]):ExtractedField[]{
 const fields:ExtractedField[]=[];
 const lower=text.toLowerCase();
 // Common patterns
 const patterns:Record<string,RegExp>={
  patient_name:/paciente[:\s]+([a-záéíóúñ\s]+)/i,
  document_date:/fecha[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  lab_glucose:/glucosa[:\s]+([\d.]+)\s*(mg\/dl|mmol\/l)/i,
  lab_hemoglobin:/hemoglobina[:\s]+([\d.]+)\s*(g\/dl)/i,
 };
 for(const[fieldName,regex]of Object.entries(patterns)){
  const match=text.match(regex);
  if(match&&match[1]){
   fields.push({
    fieldName,
    value:match[1].trim(),
    confidence:70,
    pageNumber:1,
    sourceRef:"regex-extraction",
   });
  }
 }
 return fields;
}

// Validate extracted data against clinical constraints
export function validateExtraction(fields:ExtractedField[],documentType:DocumentClassification["documentType"]):{valid:boolean;errors:string[];warnings:string[]}{
 const errors:string[]=[];
 const warnings:string[]=[];
 // Example validation for lab reports
 if(documentType==="LAB_REPORT"){
  const glucose=fields.find(f=>f.fieldName==="lab_glucose");
  if(glucose){
   const val=parseFloat(glucose.value);
   if(isNaN(val))errors.push("Glucose value not numeric");
   else if(val<10||val>1000)warnings.push(`Glucose value ${val} outside expected range`);
  }
 }
 return{valid:errors.length===0,errors,warnings};
}

// Build authoritative clinical objects from validated extraction
export function buildClinicalObjects(validatedFields:ExtractedField[],documentType:string,metadata:DocumentMetadata):Record<string,unknown>[]{
 const objects:Record<string,unknown>[]=[];
 // In production: map to specific clinical aggregates (LabResult, ImagingReport, etc.)
 if(documentType==="LAB_REPORT"){
  const labs:Record<string,unknown>={documentId:metadata.documentId,patientId:metadata.patientId,type:"LAB_RESULT"};
  for(const f of validatedFields){
   labs[f.fieldName]=f.value;
  }
  objects.push(labs);
 }
 return objects;
}

// Provenance: link extracted data to original document
export function createProvenanceLinks(documentId:string,fields:ExtractedField[]):ProvenanceLink[]{
 const links:ProvenanceLink[]=[{type:"ORIGINAL_DOCUMENT",documentId}];
 for(const f of fields){
  links.push({type:"EXTRACTION",documentId,pageNumber:f.pageNumber,sourceRef:f.sourceRef});
 }
 return links;
}

// Safe access helper
function getValue<T>(obj:Record<string,unknown>,key:string):T|undefined{
 return obj[key] as T|undefined;
}