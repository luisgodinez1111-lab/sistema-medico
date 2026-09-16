import{handleSpecimenResult}from"../../../../../../lib/specimen-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{specimenId:string}>}){const{specimenId}=await ctx.params;return handleSpecimenResult(req,specimenId);}
