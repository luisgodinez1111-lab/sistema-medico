import{handleDocumentAttach}from"../../../../../../lib/document-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// EPIC S-DOCUMENTOS/BLOB — POST /api/v1/documents/:documentId/attachments (multipart, campo "file").
// Sube el binario (PHI) al Blob store PRIVADO y registra el evento DOCUMENT_ATTACHED (solo la referencia
// va al event stream, nunca el binario). Requiere Idempotency-Key y scope document:write.
export async function POST(req:Request,ctx:{params:Promise<{documentId:string}>}){
 const{documentId}=await ctx.params;
 return handleDocumentAttach(req,documentId);
}
