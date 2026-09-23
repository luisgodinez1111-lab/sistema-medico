import{handleResultCorrection}from"../../../../../../lib/result-lifecycle";
// Auditoría C-02 — POST /api/v1/results/:id/correction: valor corregido como resultado NUEVO que supersede al original.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{resultId:string}>}){const{resultId}=await ctx.params;return handleResultCorrection(req,resultId);}
