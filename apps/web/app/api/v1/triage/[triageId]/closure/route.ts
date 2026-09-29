import{handleTriageClosure}from"../../../../../../lib/triage-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{triageId:string}>}){try{const{triageId}=await pathIds(ctx.params);return await handleTriageClosure(req,triageId);}catch(e){return httpErrorResponse(e);}}
