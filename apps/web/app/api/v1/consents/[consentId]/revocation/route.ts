import{handleConsentRevocation}from"../../../../../../lib/consent-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{consentId:string}>}){const{consentId}=await pathIds(ctx.params);return handleConsentRevocation(req,consentId);}
