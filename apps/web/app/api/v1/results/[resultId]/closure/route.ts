import{handleResultClosure}from"../../../../../../lib/result-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
// EPIC G — POST /api/v1/results/:id/closure  (ACTIONED -> CLOSED: resuelve obligación)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{resultId:string}>}){try{const{resultId}=await pathIds(ctx.params);return await handleResultClosure(req,resultId);}catch(e){return httpErrorResponse(e);}}
