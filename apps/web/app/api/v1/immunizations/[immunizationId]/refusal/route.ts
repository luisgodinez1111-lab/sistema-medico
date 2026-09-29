import{handleImmunizationRefusal}from"../../../../../../lib/immunization-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{immunizationId:string}>}){try{const{immunizationId}=await pathIds(ctx.params);return await handleImmunizationRefusal(req,immunizationId);}catch(e){return httpErrorResponse(e);}}
