import{handlePatientAmend}from"../../../../../../lib/patient-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{patientId:string}>}){const{patientId}=await ctx.params;return handlePatientAmend(req,patientId);}
