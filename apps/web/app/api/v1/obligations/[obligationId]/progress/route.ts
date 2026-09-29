import{handleObligationProgress}from"../../../../../../lib/obligation-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{obligationId:string}>}){try{const{obligationId}=await pathIds(ctx.params);return await handleObligationProgress(req,obligationId);}catch(e){return httpErrorResponse(e);}}
