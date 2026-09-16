import{handleConsentPresentation}from"../../../../../../lib/consent-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{consentId:string}>}){const{consentId}=await ctx.params;return handleConsentPresentation(req,consentId);}
