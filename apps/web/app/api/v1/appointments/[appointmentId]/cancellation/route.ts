import{handleAppointmentCancellation}from"../../../../../../lib/appointment-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request,ctx:{params:Promise<{appointmentId:string}>}){const{appointmentId}=await ctx.params;return handleAppointmentCancellation(req,appointmentId);}
