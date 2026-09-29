import{handleAllergyReactivation}from"../../../../../../lib/allergy-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{allergyId:string}>}){try{const{allergyId}=await pathIds(ctx.params);return await handleAllergyReactivation(req,allergyId);}catch(e){return httpErrorResponse(e);}}
