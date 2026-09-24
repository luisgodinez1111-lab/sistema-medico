import{handleResultErrorMark}from"../../../../../../lib/result-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
// Auditoría 2026-09-19, anexo R03 (R03-10) — POST /api/v1/results/:resultId/error-mark
// Anulación pura de un resultado (capturado en el paciente equivocado, muestra mal identificada). No borra: el evento
// queda en la cadena y el resultado deja de contar para calculadoras, series, delta check y gate de firma.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{resultId:string}>}){const{resultId}=await pathIds(ctx.params);return handleResultErrorMark(req,resultId);}
