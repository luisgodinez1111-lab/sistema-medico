import{handleCarePlanActivation}from"../../../../../../lib/careplan-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{carePlanId:string}>}){const{carePlanId}=await pathIds(ctx.params);return handleCarePlanActivation(req,carePlanId);}
