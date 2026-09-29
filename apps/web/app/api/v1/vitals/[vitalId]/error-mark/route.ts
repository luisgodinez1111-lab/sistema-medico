import{handleVitalErrorMark}from"../../../../../../lib/vital-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{vitalId:string}>}){try{const{vitalId}=await pathIds(ctx.params);return await handleVitalErrorMark(req,vitalId);}catch(e){return httpErrorResponse(e);}}
