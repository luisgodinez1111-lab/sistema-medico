import{handleWoundEscalation}from"../../../../../../lib/wound-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{woundId:string}>}){try{const{woundId}=await pathIds(ctx.params);return await handleWoundEscalation(req,woundId);}catch(e){return httpErrorResponse(e);}}
