import{handleTriageLwbs}from"../../../../../../lib/triage-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{triageId:string}>}){const{triageId}=await ctx.params;return handleTriageLwbs(req,triageId);}
