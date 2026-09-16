import{handleObligationCancellation}from"../../../../../../lib/obligation-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{obligationId:string}>}){const{obligationId}=await ctx.params;return handleObligationCancellation(req,obligationId);}
