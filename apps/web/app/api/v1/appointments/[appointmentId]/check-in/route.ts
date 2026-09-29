import{handleAppointmentCheckIn}from"../../../../../../lib/appointment-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
import{httpErrorResponse}from"../../../../../../lib/http-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{appointmentId:string}>}){try{const{appointmentId}=await pathIds(ctx.params);return await handleAppointmentCheckIn(req,appointmentId);}catch(e){return httpErrorResponse(e);}}
