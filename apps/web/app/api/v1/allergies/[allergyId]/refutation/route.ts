import{handleAllergyRefutation}from"../../../../../../lib/allergy-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{allergyId:string}>}){const{allergyId}=await pathIds(ctx.params);return handleAllergyRefutation(req,allergyId);}
