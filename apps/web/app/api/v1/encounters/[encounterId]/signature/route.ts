import{handleSignature}from"../../../../../../lib/encounter-lifecycle";
// EPIC D — POST /api/v1/encounters/:id/signature  (READY_TO_SIGN -> SIGNED)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{encounterId:string}>}){
 const{encounterId}=await ctx.params;
 return handleSignature(req,encounterId);
}
