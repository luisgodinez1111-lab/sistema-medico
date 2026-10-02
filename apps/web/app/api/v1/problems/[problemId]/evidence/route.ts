import{handleProblemEvidenceUpdate}from"../../../../../../lib/problem-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
// Auditoría 2026-09-19 (L-04) — POST /api/v1/problems/:id/evidence — evidencia a favor/en contra y confianza del diagnóstico. Anotación; no cambia el estado.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{problemId:string}>}){try{const{problemId}=await pathIds(ctx.params);return await handleProblemEvidenceUpdate(req,problemId);}catch(e){return httpErrorResponse(e);}}
