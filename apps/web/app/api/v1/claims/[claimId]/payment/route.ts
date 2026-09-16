import{handleClaimPayment}from"../../../../../../lib/claim-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{claimId:string}>}){const{claimId}=await ctx.params;return handleClaimPayment(req,claimId);}
