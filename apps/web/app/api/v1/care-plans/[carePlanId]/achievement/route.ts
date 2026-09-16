import{handleCarePlanAchievement}from"../../../../../../lib/careplan-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{carePlanId:string}>}){const{carePlanId}=await ctx.params;return handleCarePlanAchievement(req,carePlanId);}
