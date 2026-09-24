import{handleSurgeryCompletion}from"../../../../../../lib/surgery-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{surgeryId:string}>}){const{surgeryId}=await pathIds(ctx.params);return handleSurgeryCompletion(req,surgeryId);}
