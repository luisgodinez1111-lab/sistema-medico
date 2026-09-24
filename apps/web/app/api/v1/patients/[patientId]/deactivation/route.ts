import{handlePatientDeactivation}from"../../../../../../lib/patient-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{patientId:string}>}){const{patientId}=await pathIds(ctx.params);return handlePatientDeactivation(req,patientId);}
