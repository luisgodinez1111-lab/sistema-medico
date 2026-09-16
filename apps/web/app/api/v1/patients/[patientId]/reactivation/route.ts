import{handlePatientReactivation}from"../../../../../../lib/patient-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{patientId:string}>}){const{patientId}=await ctx.params;return handlePatientReactivation(req,patientId);}
