import{handleObligationProgress}from"../../../../../../lib/obligation-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{obligationId:string}>}){const{obligationId}=await ctx.params;return handleObligationProgress(req,obligationId);}
