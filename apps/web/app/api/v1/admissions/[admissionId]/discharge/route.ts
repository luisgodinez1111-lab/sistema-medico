import{handleAdmissionDischarge}from"../../../../../../lib/admission-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{admissionId:string}>}){try{const{admissionId}=await pathIds(ctx.params);return await handleAdmissionDischarge(req,admissionId);}catch(e){return httpErrorResponse(e);}}
