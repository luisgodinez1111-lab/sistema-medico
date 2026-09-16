import{handleTransfusionStart}from"../../../../../../lib/transfusion-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{transfusionId:string}>}){const{transfusionId}=await ctx.params;return handleTransfusionStart(req,transfusionId);}
