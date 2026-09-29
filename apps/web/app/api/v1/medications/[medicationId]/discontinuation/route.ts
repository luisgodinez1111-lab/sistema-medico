import{handleMedicationDiscontinuation}from"../../../../../../lib/medication-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
// EPIC H — POST /api/v1/medications/:id/discontinuation
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{medicationId:string}>}){try{const{medicationId}=await pathIds(ctx.params);return await handleMedicationDiscontinuation(req,medicationId);}catch(e){return httpErrorResponse(e);}}
