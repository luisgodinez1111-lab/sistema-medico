import{handleAdmissionCancellation}from"../../../../../../lib/admission-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{admissionId:string}>}){const{admissionId}=await ctx.params;return handleAdmissionCancellation(req,admissionId);}
