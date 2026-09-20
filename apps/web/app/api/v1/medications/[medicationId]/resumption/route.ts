import{handleMedicationResume}from"../../../../../../lib/medication-lifecycle";
// Auditoría 2026-09-19 (L-04) — POST /api/v1/medications/:id/resumption — HELD -> ACTIVE. Reevalúa las barreras de seguridad (mismo evaluador que PRESCRIBE).
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{medicationId:string}>}){const{medicationId}=await ctx.params;return handleMedicationResume(req,medicationId);}
