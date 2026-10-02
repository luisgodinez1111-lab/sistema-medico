import{handleProblemResolution}from"../../../../../../lib/problem-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{problemId:string}>}){try{const{problemId}=await pathIds(ctx.params);return await handleProblemResolution(req,problemId);}catch(e){return httpErrorResponse(e);}}
