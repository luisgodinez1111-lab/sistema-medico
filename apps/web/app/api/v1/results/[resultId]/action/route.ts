import{handleResultAction}from"../../../../../../lib/result-lifecycle";
// EPIC G — POST /api/v1/results/:id/action  (VERIFIED -> ACTIONED: crea obligación)
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{resultId:string}>}){const{resultId}=await ctx.params;return handleResultAction(req,resultId);}
