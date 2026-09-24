import{handleDocumentSignature}from"../../../../../../lib/document-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
// EPIC I — POST /api/v1/documents/:id/signature
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{documentId:string}>}){const{documentId}=await pathIds(ctx.params);return handleDocumentSignature(req,documentId);}
