import{handlePatientDeactivation}from"../../../../../../lib/patient-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{patientId:string}>}){try{const{patientId}=await pathIds(ctx.params);return await handlePatientDeactivation(req,patientId);}catch(e){return httpErrorResponse(e);}}
