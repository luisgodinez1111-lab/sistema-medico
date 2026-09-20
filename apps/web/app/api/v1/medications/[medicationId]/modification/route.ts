import{handleMedicationModification}from"../../../../../../lib/medication-lifecycle";
// Auditoría 2026-09-19 (L-04) — POST /api/v1/medications/:id/modification — cambia dosis/vía/frecuencia de una medicación en curso (anotación; no cambia el estado). Pasa por las barreras de seguridad.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{medicationId:string}>}){const{medicationId}=await ctx.params;return handleMedicationModification(req,medicationId);}
