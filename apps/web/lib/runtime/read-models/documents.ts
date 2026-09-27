// Lote 11 (ADR-0300) — read models de documentos clínicos. Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import{type HttpTenantContext}from"../../../../../packages/http-principal/src";
import{withTenantTx}from"../db";
// EPIC Z/UI — Documentos clínicos de UN paciente (vista Documentos). Por cada agregado ClinicalDocument toma el
// evento base DOCUMENT_CREATED (tipo/título/fecha) y su ESTADO por la última transición
// (CREATED->DRAFT, FINALIZED, SIGNED, AMENDED). RLS-scoped.
export type DocRow=Readonly<{documentId:string;title:string;docType:string;status:"DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED";createdAt:string;actorId:string}>;
const DOC_STATUS:Record<string,"DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED">={CREATED:"DRAFT",FINALIZED:"FINALIZED",SIGNED:"SIGNED",AMENDED:"AMENDED"};
export async function patientDocuments(ctx:HttpTenantContext,patientId:string):Promise<DocRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'title' as title, a.payload->>'docType' as doc_type, a.occurred_at as created_at, a.actor_id as actor_id,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalDocument' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   documentId:String(o.aggregate_id),title:String(o.title??""),docType:String(o.doc_type??"OTHER"),
   status:DOC_STATUS[String(o.last_kind??"CREATED")]??"DRAFT",
   createdAt:o.created_at?new Date(String(o.created_at)).toISOString():"",actorId:String(o.actor_id??"")};});
 }) as Promise<DocRow[]>;
}
// EPIC Z/UI — Repositorio de documentos: UN documento clínico con su CONTENIDO real, adenda (append-only) y
// firma, plegando todos sus eventos (CREATED/FINALIZED/SIGNED/AMENDED) en orden. RLS-scoped. Nunca borra: cada
// enmienda suma. version = nº de eventos del agregado.
export type DocAddendum=Readonly<{addendum:string;authorId:string;at:string}>;
export type DocSignature=Readonly<{authorId:string;contentHash:string;signatureDigest:string;signedAt:string}>;
// Un archivo binario adjunto (PHI) guardado en Vercel Blob privado. En el event stream SOLO va la referencia
// (pathname del blob + hash + metadatos), nunca el binario. attachmentId = id determinista del evento adjunto.
export type DocAttachment=Readonly<{attachmentId:string;filename:string;mime:string;size:number;pathname:string;contentHash:string;authorId:string;attachedAt:string}>;
export type DocumentDetail=Readonly<{exists:boolean;documentId:string;patientId:string;title:string;docType:string;content:string;state:"DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED";version:number;createdAt:string;addenda:DocAddendum[];signature:DocSignature|null;attachments:DocAttachment[]}>;
export async function documentDetail(ctx:HttpTenantContext,documentId:string):Promise<DocumentDetail>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.payload as payload, a.occurred_at as occurred_at
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalDocument' and a.aggregate_id=${documentId}
   order by a.sequence asc`;
  if(rows.length===0)return{exists:false,documentId,patientId:"",title:"",docType:"",content:"",state:"DRAFT",version:0,createdAt:"",addenda:[],signature:null,attachments:[]};
  let patientId="",title="",docType="",content="",createdAt="",state:DocumentDetail["state"]="DRAFT",signature:DocSignature|null=null;const addenda:DocAddendum[]=[];const attachments:DocAttachment[]=[];
  for(const r of rows){const o=r as Record<string,unknown>;const p=(o.payload??{}) as Record<string,unknown>;const at=o.occurred_at?new Date(String(o.occurred_at)).toISOString():"";
   switch(String(p.kind)){
    case"CREATED":patientId=String(p.patientId??"");docType=String(p.docType??"OTHER");title=String(p.title??"");content=String(p.content??"");createdAt=at;state="DRAFT";break;
    case"FINALIZED":state="FINALIZED";break;
    case"SIGNED":state="SIGNED";signature={authorId:String(p.authorId??""),contentHash:String(p.contentHash??""),signatureDigest:String(p.signatureDigest??""),signedAt:String(p.signedAt??at)};break;
    case"AMENDED":state="AMENDED";addenda.push({addendum:String(p.addendum??""),authorId:String(p.authorId??""),at:String(p.amendedAt??at)});break;
    case"ATTACHED":attachments.push({attachmentId:String(p.attachmentId??""),filename:String(p.filename??"archivo"),mime:String(p.mime??"application/octet-stream"),size:Number(p.size??0),pathname:String(p.pathname??""),contentHash:String(p.contentHash??""),authorId:String(p.authorId??""),attachedAt:String(p.attachedAt??at)});break;
    case"ATTACHMENT_REMOVED":{const rid=String(p.attachmentId??"");const idx=attachments.findIndex(a=>a.attachmentId===rid);if(idx>=0)attachments.splice(idx,1);break;}
   }
  }
  return{exists:true,documentId,patientId,title,docType,content,state,version:rows.length,createdAt,addenda,signature,attachments};
 }) as Promise<DocumentDetail>;
}
