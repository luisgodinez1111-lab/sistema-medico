import{handleVitalAmendment}from"../../../../../../lib/vital-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{vitalId:string}>}){const{vitalId}=await ctx.params;return handleVitalAmendment(req,vitalId);}
