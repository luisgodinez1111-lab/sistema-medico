import{handleDialysisStart}from"../../../../../../lib/dialysis-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{dialysisId:string}>}){try{const{dialysisId}=await pathIds(ctx.params);return await handleDialysisStart(req,dialysisId);}catch(e){return httpErrorResponse(e);}}
