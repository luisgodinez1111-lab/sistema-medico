import{handleDocumentDownload,handleDocumentAttachmentRemove}from"../../../../../../../lib/document-lifecycle";
import{pathIds}from"../../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// EPIC S-DOCUMENTOS/BLOB — GET descarga el binario adjunto a través de la Function (privado, nunca URL pública),
// verificando tenant + scope. DELETE quita el adjunto (borra el blob y registra ATTACHMENT_REMOVED, append-only).
export async function GET(req:Request,ctx:{params:Promise<{documentId:string;attachmentId:string}>}){
 try{
  const{documentId,attachmentId}=await pathIds(ctx.params);
  return await handleDocumentDownload(req,documentId,attachmentId);
 }catch(e){return httpErrorResponse(e);}
}
export async function DELETE(req:Request,ctx:{params:Promise<{documentId:string;attachmentId:string}>}){
 try{
  const{documentId,attachmentId}=await pathIds(ctx.params);
  return await handleDocumentAttachmentRemove(req,documentId,attachmentId);
 }catch(e){return httpErrorResponse(e);}
}
