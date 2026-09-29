import{handleSpecimenTransit}from"../../../../../../lib/specimen-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{specimenId:string}>}){try{const{specimenId}=await pathIds(ctx.params);return await handleSpecimenTransit(req,specimenId);}catch(e){return httpErrorResponse(e);}}
