import{handleAssessment}from"../../../../../../lib/encounter-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
// EPIC D — POST /api/v1/encounters/:id/assessment  (OPEN -> READY_TO_SIGN)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{encounterId:string}>}){
 try{
  const{encounterId}=await pathIds(ctx.params);
  return await handleAssessment(req,encounterId);
 }catch(e){return httpErrorResponse(e);}
}
