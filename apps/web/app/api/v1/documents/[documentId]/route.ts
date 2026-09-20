import{handleDocumentGet}from"../../../../../lib/document-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// EPIC Z/UI — GET /api/v1/documents/:documentId (repositorio): un documento con su CONTENIDO real, adenda
// (append-only) y firma, plegando sus eventos. Solo lectura, RLS-scoped.
export async function GET(req:Request,ctx:{params:Promise<{documentId:string}>}){
 const{documentId}=await ctx.params;
 return handleDocumentGet(req,documentId);
}
