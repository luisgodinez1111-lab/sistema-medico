import{handleDocumentFinalization}from"../../../../../../lib/document-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
// EPIC I — POST /api/v1/documents/:id/finalization
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{documentId:string}>}){try{const{documentId}=await pathIds(ctx.params);return await handleDocumentFinalization(req,documentId);}catch(e){return httpErrorResponse(e);}}
