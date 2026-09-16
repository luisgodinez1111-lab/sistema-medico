import{handleAppointmentSchedule}from"../../../../lib/appointment-lifecycle";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleAppointmentSchedule(req);}
