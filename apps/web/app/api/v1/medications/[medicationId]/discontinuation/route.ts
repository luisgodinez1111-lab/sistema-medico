import{handleMedicationDiscontinuation}from"../../../../../../lib/medication-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
// EPIC H — POST /api/v1/medications/:id/discontinuation
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{medicationId:string}>}){const{medicationId}=await pathIds(ctx.params);return handleMedicationDiscontinuation(req,medicationId);}
