import{handleMedicationResume}from"../../../../../../lib/medication-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
// Auditoría 2026-09-19 (L-04) — POST /api/v1/medications/:id/resumption — HELD -> ACTIVE. Reevalúa las barreras de seguridad (mismo evaluador que PRESCRIBE).
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{medicationId:string}>}){try{const{medicationId}=await pathIds(ctx.params);return await handleMedicationResume(req,medicationId);}catch(e){return httpErrorResponse(e);}}
