import{handleImmunizationRefusal}from"../../../../../../lib/immunization-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{immunizationId:string}>}){const{immunizationId}=await ctx.params;return handleImmunizationRefusal(req,immunizationId);}
