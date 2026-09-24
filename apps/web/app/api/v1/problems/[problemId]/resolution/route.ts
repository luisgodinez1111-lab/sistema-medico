import{handleProblemResolution}from"../../../../../../lib/problem-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{problemId:string}>}){const{problemId}=await pathIds(ctx.params);return handleProblemResolution(req,problemId);}
