import{handleTriageStart}from"../../../../../../lib/triage-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{triageId:string}>}){const{triageId}=await pathIds(ctx.params);return handleTriageStart(req,triageId);}
