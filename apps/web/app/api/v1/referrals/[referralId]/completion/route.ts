import{handleReferralCompletion}from"../../../../../../lib/referral-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{referralId:string}>}){const{referralId}=await pathIds(ctx.params);return handleReferralCompletion(req,referralId);}
