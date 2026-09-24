import{ClinicalError}from"../../../../../../packages/runtime-errors/src";
import{NextResponse}from"next/server";
import{handleAppointmentSchedule}from"../../../../lib/appointment-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{agendaForDate}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
import{dayOf,dayWindow}from"../../../../lib/clinic-time";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleAppointmentSchedule(req);}
// EPIC CM — GET /api/v1/appointments?date=YYYY-MM-DD -> agenda del día (citas + estado + paciente).
// Sin date: usa hoy. Determinista, RLS-scoped.
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"appointment:read",purpose:"TREATMENT"});
  const url=new URL(req.url);
  // Auditoría L-12: el día de agenda es el día CIVIL del consultorio (zona de México), no el día UTC.
  const dateStr=url.searchParams.get("date")||dayOf(new Date().toISOString());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))throw new ClinicalError("VALIDATION_ERROR","date debe ser YYYY-MM-DD");
  const{fromIso,toIso}=dayWindow(dateStr);
  const appointments=await agendaForDate(ctx,fromIso,toIso);
  const counts={programadas:appointments.length,
   atendidas:appointments.filter(a=>a.status==="COMPLETED").length,
   enEspera:appointments.filter(a=>a.status==="CHECKED_IN").length,
   canceladas:appointments.filter(a=>a.status==="CANCELLED"||a.status==="NO_SHOW").length};
  return NextResponse.json({date:dateStr,appointments,counts},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
