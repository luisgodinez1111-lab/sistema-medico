import{handleProblemEpistemicUpdate}from"../../../../../../lib/problem-lifecycle";
// Auditoría 2026-09-19 (L-04) — POST /api/v1/problems/:id/epistemic-status — estado epistémico del diagnóstico (POSSIBLE/PROBABLE/CONFIRMED/…). Anotación; no cambia el estado.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{problemId:string}>}){const{problemId}=await ctx.params;return handleProblemEpistemicUpdate(req,problemId);}
