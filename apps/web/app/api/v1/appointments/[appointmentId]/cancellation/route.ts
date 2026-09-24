import{handleAppointmentCancellation}from"../../../../../../lib/appointment-lifecycle";
import{pathIds}from"../../../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{appointmentId:string}>}){const{appointmentId}=await pathIds(ctx.params);return handleAppointmentCancellation(req,appointmentId);}
