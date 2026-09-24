import{handleMedicationHold}from"../../../../../../lib/medication-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
// Auditoría 2026-09-19 (L-04) — POST /api/v1/medications/:id/hold — ACTIVE -> HELD (suspensión temporal con razón). Médico + medication:write + If-Match.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{medicationId:string}>}){const{medicationId}=await pathIds(ctx.params);return handleMedicationHold(req,medicationId);}
