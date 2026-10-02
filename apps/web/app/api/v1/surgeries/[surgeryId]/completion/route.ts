import{handleSurgeryCompletion}from"../../../../../../lib/surgery-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{surgeryId:string}>}){try{const{surgeryId}=await pathIds(ctx.params);return await handleSurgeryCompletion(req,surgeryId);}catch(e){return httpErrorResponse(e);}}
