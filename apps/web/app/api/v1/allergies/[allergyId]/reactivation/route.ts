import{handleAllergyReactivation}from"../../../../../../lib/allergy-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{allergyId:string}>}){const{allergyId}=await ctx.params;return handleAllergyReactivation(req,allergyId);}
