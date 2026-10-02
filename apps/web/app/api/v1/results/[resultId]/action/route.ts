import{handleResultAction}from"../../../../../../lib/result-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
// EPIC G — POST /api/v1/results/:id/action  (VERIFIED -> ACTIONED: crea obligación)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{resultId:string}>}){try{const{resultId}=await pathIds(ctx.params);return await handleResultAction(req,resultId);}catch(e){return httpErrorResponse(e);}}
