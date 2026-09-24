import{handleClaimSubmission}from"../../../../../../lib/claim-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{claimId:string}>}){const{claimId}=await pathIds(ctx.params);return handleClaimSubmission(req,claimId);}
