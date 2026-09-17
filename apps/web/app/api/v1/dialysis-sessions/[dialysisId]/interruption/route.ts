import{handleDialysisInterruption}from"../../../../../../lib/dialysis-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{dialysisId:string}>}){const{dialysisId}=await ctx.params;return handleDialysisInterruption(req,dialysisId);}
