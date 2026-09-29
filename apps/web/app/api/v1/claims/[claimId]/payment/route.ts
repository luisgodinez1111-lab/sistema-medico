import{handleClaimPayment}from"../../../../../../lib/claim-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{claimId:string}>}){try{const{claimId}=await pathIds(ctx.params);return await handleClaimPayment(req,claimId);}catch(e){return httpErrorResponse(e);}}
