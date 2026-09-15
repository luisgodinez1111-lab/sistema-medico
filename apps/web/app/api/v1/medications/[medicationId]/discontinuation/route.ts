import{handleMedicationDiscontinuation}from"../../../../../../lib/medication-lifecycle";
// EPIC H — POST /api/v1/medications/:id/discontinuation
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{medicationId:string}>}){const{medicationId}=await ctx.params;return handleMedicationDiscontinuation(req,medicationId);}
