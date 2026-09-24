import{NextResponse}from"next/server";
import{authorize}from"../../../../../../../../packages/runtime-auth/src";
import{patientDocuments}from"../../../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../../../lib/http-command";
// EPIC Z/UI — GET /api/v1/patients/:id/documents  (vista Documentos: lista + carpetas por tipo)
// Cada documento con título, tipo-UI, estado, fecha; MÁS conteos por carpeta (tipo) para el panel de carpetas
// y los chips del paciente. Determinista, RLS-scoped.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const TYPE_UI:Record<string,string>={PROGRESS_NOTE:"Nota médica",DISCHARGE_SUMMARY:"Alta",REFERRAL:"Interconsulta",PROCEDURE_NOTE:"Procedimiento",OTHER:"Otro"};
const STATUS_ES:Record<string,string>={DRAFT:"Borrador",FINALIZED:"Finalizado",SIGNED:"Firmado",AMENDED:"Enmendado"};
export async function GET(req:Request,ctx:{params:Promise<{patientId:string}>}){
 try{
  const{patientId}=await ctx.params;
  const{claims,ctx:tctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"document:read",purpose:"TREATMENT"});
  const rows=await patientDocuments(tctx,patientId);
  const items=rows.map(r=>({
   documentId:r.documentId,title:r.title,
   docType:r.docType,typeLabel:TYPE_UI[r.docType]??"Otro",
   status:r.status,statusLabel:STATUS_ES[r.status]??"Borrador",
   createdAt:r.createdAt,actorId:r.actorId}));
  const total=items.length;
  const byType:Record<string,number>={};
  for(const it of items)byType[it.typeLabel]=(byType[it.typeLabel]??0)+1;
  // Conteos para los chips del paciente (agrupaciones amplias).
  const clinical=items.filter(i=>i.docType==="PROGRESS_NOTE"||i.docType==="PROCEDURE_NOTE"||i.docType==="DISCHARGE_SUMMARY").length;
  const consents=byType["Consentimiento"]??0; // (no hay tipo Consentimiento en el enum; queda 0 real)
  return NextResponse.json({items,total,byType,chips:{clinical,consents,studies:0}},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
