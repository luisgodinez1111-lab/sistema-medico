import{handleReferralAcceptance}from"../../../../../../lib/referral-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{referralId:string}>}){const{referralId}=await ctx.params;return handleReferralAcceptance(req,referralId);}
