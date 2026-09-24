import{handleDialysisCancellation}from"../../../../../../lib/dialysis-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{dialysisId:string}>}){const{dialysisId}=await pathIds(ctx.params);return handleDialysisCancellation(req,dialysisId);}
