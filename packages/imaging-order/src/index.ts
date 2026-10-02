// EPIC P — Imaging Order domain (DICOM/PACS integration ready).
// SM: DRAFT -> ORDERED -> ACQUIRED -> REPORTED -> VERIFIED -> SIGNED -> CANCELLED.
// Physician Control: ordenar/adquirir/reportar/firmar exige médico.
// Interoperabilidad: DICOM worklist, PACS push, HL7/FHIR mapping.
// Autoridad: CAP-IMAGING-ORDER-001, PROD-026 (órdenes de imagen).
import{ClinicalError}from"../../runtime-errors/src";

export type ImagingOrderState="DRAFT"|"ORDERED"|"ACQUIRED"|"REPORTED"|"VERIFIED"|"SIGNED"|"CANCELLED";
export type ImagingOrderEventKind="CREATED"|"PLACED"|"ACQUIRED"|"REPORTED"|"VERIFIED"|"SIGNED"|"CANCELLED";
export type StoredImagingEvent=Readonly<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedImagingOrder=Readonly<{exists:boolean;state:ImagingOrderState;version:number;patientId:string;modality:string}>;

function kindOf(e:StoredImagingEvent):ImagingOrderEventKind{
 const k=e.payload["kind"];
 if(k==="CREATED"||k==="PLACED"||k==="ACQUIRED"||k==="REPORTED"||k==="VERIFIED"||k==="SIGNED"||k==="CANCELLED")return k;
 if(e.sequence===1&&k===undefined)return "CREATED"; // génesis heredada SIN discriminador; un `kind` ajeno no es génesis (porte D4)
 throw new ClinicalError("INVARIANT_VIOLATION",`Unknown imaging order event at sequence ${e.sequence}`);
}
const KIND_TO_STATE:Record<ImagingOrderEventKind,ImagingOrderState>={CREATED:"DRAFT",PLACED:"ORDERED",ACQUIRED:"ACQUIRED",REPORTED:"REPORTED",VERIFIED:"VERIFIED",SIGNED:"SIGNED",CANCELLED:"CANCELLED"};
export function foldImagingOrder(events:readonly StoredImagingEvent[]):FoldedImagingOrder{
 if(events.length===0)return{exists:false,state:"DRAFT",version:0,patientId:"",modality:""};
 const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
 let state:ImagingOrderState="DRAFT",patientId="",modality="";
 for(const e of ordered){
  state=KIND_TO_STATE[kindOf(e)];
  if(kindOf(e)==="CREATED"){patientId=String(e.payload["patientId"]??"");modality=String(e.payload["modality"]??"");}
 }
 return{exists:true,state,version:ordered[ordered.length-1]!.sequence,patientId,modality};
}
const ALLOWED:Partial<Record<ImagingOrderState,readonly ImagingOrderState[]>>={
 DRAFT:["ORDERED","CANCELLED"],ORDERED:["ACQUIRED","CANCELLED"],ACQUIRED:["REPORTED","CANCELLED"],
 REPORTED:["VERIFIED","CANCELLED"],VERIFIED:["SIGNED"],SIGNED:["CANCELLED"],
};
export function assertImagingTransition(from:ImagingOrderState,to:ImagingOrderState){
 if(!ALLOWED[from]?.includes(to))throw new ClinicalError("CONFLICT",`Illegal imaging transition ${from} -> ${to}`,{from,to});
}

// DICOM mapping helpers (simplified)
export const DICOM_MODALITIES=["CR","CT","DX","MG","MR","NM","PT","RF","RG","US","XA","XC"]as const;
export type DicomModality=typeof DICOM_MODALITIES[number];

export function validateModality(modality:string):modality is DicomModality{
 return DICOM_MODALITIES.includes(modality as DicomModality);
}