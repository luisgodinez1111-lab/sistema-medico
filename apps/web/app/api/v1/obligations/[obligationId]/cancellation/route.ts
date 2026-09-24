import{handleObligationCancellation}from"../../../../../../lib/obligation-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{obligationId:string}>}){const{obligationId}=await pathIds(ctx.params);return handleObligationCancellation(req,obligationId);}
