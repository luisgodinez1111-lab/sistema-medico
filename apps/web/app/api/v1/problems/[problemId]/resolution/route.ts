import{handleProblemResolution}from"../../../../../../lib/problem-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{problemId:string}>}){const{problemId}=await ctx.params;return handleProblemResolution(req,problemId);}
