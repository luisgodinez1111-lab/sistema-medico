import{handleResultClosure}from"../../../../../../lib/result-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
// EPIC G — POST /api/v1/results/:id/closure  (ACTIONED -> CLOSED: resuelve obligación)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{resultId:string}>}){const{resultId}=await pathIds(ctx.params);return handleResultClosure(req,resultId);}
