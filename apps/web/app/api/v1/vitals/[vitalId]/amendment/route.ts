import{handleVitalAmendment}from"../../../../../../lib/vital-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{vitalId:string}>}){const{vitalId}=await pathIds(ctx.params);return handleVitalAmendment(req,vitalId);}
