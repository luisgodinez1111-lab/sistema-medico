import{handleAdmissionDischarge}from"../../../../../../lib/admission-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{admissionId:string}>}){const{admissionId}=await pathIds(ctx.params);return handleAdmissionDischarge(req,admissionId);}
