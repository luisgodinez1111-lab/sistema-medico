import{handleProblemEvidenceUpdate}from"../../../../../../lib/problem-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
// Auditoría 2026-09-19 (L-04) — POST /api/v1/problems/:id/evidence — evidencia a favor/en contra y confianza del diagnóstico. Anotación; no cambia el estado.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{problemId:string}>}){const{problemId}=await pathIds(ctx.params);return handleProblemEvidenceUpdate(req,problemId);}
