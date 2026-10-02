import{handleReferralCompletion}from"../../../../../../lib/referral-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{referralId:string}>}){try{const{referralId}=await pathIds(ctx.params);return await handleReferralCompletion(req,referralId);}catch(e){return httpErrorResponse(e);}}
