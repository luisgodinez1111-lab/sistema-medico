import{handleTransfusionCompletion}from"../../../../../../lib/transfusion-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{transfusionId:string}>}){try{const{transfusionId}=await pathIds(ctx.params);return await handleTransfusionCompletion(req,transfusionId);}catch(e){return httpErrorResponse(e);}}
