import{handleResultCorrection}from"../../../../../../lib/result-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
// Auditoría C-02 — POST /api/v1/results/:id/correction: valor corregido como resultado NUEVO que supersede al original.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{resultId:string}>}){try{const{resultId}=await pathIds(ctx.params);return await handleResultCorrection(req,resultId);}catch(e){return httpErrorResponse(e);}}
