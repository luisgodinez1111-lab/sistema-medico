import{handleWoundReassessment}from"../../../../../../lib/wound-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{woundId:string}>}){const{woundId}=await ctx.params;return handleWoundReassessment(req,woundId);}
