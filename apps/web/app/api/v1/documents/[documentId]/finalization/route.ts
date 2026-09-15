import{handleDocumentFinalization}from"../../../../../../lib/document-lifecycle";
// EPIC I — POST /api/v1/documents/:id/finalization
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{documentId:string}>}){const{documentId}=await ctx.params;return handleDocumentFinalization(req,documentId);}
