import{handleMedicationModification}from"../../../../../../lib/medication-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
// Auditoría 2026-09-19 (L-04) — POST /api/v1/medications/:id/modification — cambia dosis/vía/frecuencia de una medicación en curso (anotación; no cambia el estado). Pasa por las barreras de seguridad.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{medicationId:string}>}){try{const{medicationId}=await pathIds(ctx.params);return await handleMedicationModification(req,medicationId);}catch(e){return httpErrorResponse(e);}}
