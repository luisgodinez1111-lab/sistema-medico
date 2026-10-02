import{handleConsentPresentation}from"../../../../../../lib/consent-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{consentId:string}>}){try{const{consentId}=await pathIds(ctx.params);return await handleConsentPresentation(req,consentId);}catch(e){return httpErrorResponse(e);}}
