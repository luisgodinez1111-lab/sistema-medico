import{handleMedicationResume}from"../../../../../../lib/medication-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
// Auditoría 2026-09-19 (L-04) — POST /api/v1/medications/:id/resumption — HELD -> ACTIVE. Reevalúa las barreras de seguridad (mismo evaluador que PRESCRIBE).
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{medicationId:string}>}){const{medicationId}=await pathIds(ctx.params);return handleMedicationResume(req,medicationId);}
