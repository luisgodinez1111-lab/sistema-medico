import{NextResponse}from"next/server";
import{handleAppointmentSchedule}from"../../../../lib/appointment-lifecycle";
import{authorize}from"../../../../../../packages/runtime-auth/src";
import{agendaForDate}from"../../../../lib/clinical-runtime";
import{toHttpError}from"../../../../lib/http-errors";
import{resolveVerified,principalFrom}from"../../../../lib/http-command";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleAppointmentSchedule(req);}
// EPIC CM — GET /api/v1/appointments?date=YYYY-MM-DD -> agenda del día (citas + estado + paciente).
// Sin date: usa hoy. Determinista, RLS-scoped.
export async function GET(req:Request){
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"appointment:read",purpose:"TREATMENT"});
  const url=new URL(req.url);
  const dateStr=url.searchParams.get("date")||new Date().toISOString().slice(0,10);
  const fromIso=`${dateStr}T00:00:00.000Z`,toIso=`${dateStr}T23:59:59.999Z`;
  const appointments=await agendaForDate(ctx,fromIso,toIso);
  const counts={programadas:appointments.length,
   atendidas:appointments.filter(a=>a.status==="COMPLETED").length,
   enEspera:appointments.filter(a=>a.status==="CHECKED_IN").length,
   canceladas:appointments.filter(a=>a.status==="CANCELLED"||a.status==="NO_SHOW").length};
  return NextResponse.json({date:dateStr,appointments,counts},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
