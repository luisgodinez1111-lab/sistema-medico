import{handleAssessment}from"../../../../../../lib/encounter-lifecycle";
// EPIC D — POST /api/v1/encounters/:id/assessment  (OPEN -> READY_TO_SIGN)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{encounterId:string}>}){
 const{encounterId}=await ctx.params;
 return handleAssessment(req,encounterId);
}
