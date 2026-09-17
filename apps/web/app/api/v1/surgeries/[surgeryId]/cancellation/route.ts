import{handleSurgeryCancellation}from"../../../../../../lib/surgery-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{surgeryId:string}>}){const{surgeryId}=await ctx.params;return handleSurgeryCancellation(req,surgeryId);}
