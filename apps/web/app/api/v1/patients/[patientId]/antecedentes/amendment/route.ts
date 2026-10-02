import{handleAntecedentesAmend}from"../../../../../../../lib/antecedentes-lifecycle";
import{pathIds}from"../../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../../lib/http-errors";
// MATRIZ FUNDACIONAL — POST /api/v1/patients/:id/antecedentes/amendment: enmienda la matriz con motivo (AMENDED).
// El histórico nunca se sobrescribe: cada edición es un evento nuevo (If-Match + Idempotency-Key obligatorios).
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{patientId:string}>}){try{const{patientId}=await pathIds(ctx.params);return await handleAntecedentesAmend(req,patientId);}catch(e){return httpErrorResponse(e);}}
