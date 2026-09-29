import{handleCarePlanResume}from"../../../../../../lib/careplan-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{carePlanId:string}>}){try{const{carePlanId}=await pathIds(ctx.params);return await handleCarePlanResume(req,carePlanId);}catch(e){return httpErrorResponse(e);}}
