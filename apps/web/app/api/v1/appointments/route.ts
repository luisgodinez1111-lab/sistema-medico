import{ClinicalError}from"../../../../../../packages/runtime-errors/src";
import{NextResponse}from"next/server";
import{handleAppointmentSchedule}from"../../../../lib/appointment-lifecycle";
import{agendaForDate}from"../../../../lib/clinical-runtime";
import{withClinicalAuth}from"../../../../lib/http-command";
import{dayOf,dayWindow}from"../../../../lib/clinic-time";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(req:Request){return handleAppointmentSchedule(req);}
// EPIC CM — GET /api/v1/appointments -> agenda (citas + estado + paciente). Determinista, RLS-scoped.
//   ?date=YYYY-MM-DD                 -> un solo día (sin date: hoy).
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   -> rango inclusivo (Lote F: vistas semanal/mensual). Máx. 62 días.
// El día de agenda es el día CIVIL del consultorio (zona de México), no el día UTC (auditoría L-12).
const RANGE_MAX_DAYS=62;
export async function GET(req:Request){
 // R04-019: el contrato (sesión → autorización → traducción del fallo) lo aplica `withClinicalAuth`.
 return withClinicalAuth(req,{scope:"appointment:read",purpose:"TREATMENT"},async({claims,ctx})=>{
  const url=new URL(req.url);
  const fromStr=url.searchParams.get("from"),toStr=url.searchParams.get("to");
  if(fromStr||toStr){
   if(!fromStr||!toStr)throw new ClinicalError("VALIDATION_ERROR","from y to deben venir juntos");
   if(!/^\d{4}-\d{2}-\d{2}$/.test(fromStr)||!/^\d{4}-\d{2}-\d{2}$/.test(toStr))throw new ClinicalError("VALIDATION_ERROR","from/to deben ser YYYY-MM-DD");
   if(toStr<fromStr)throw new ClinicalError("VALIDATION_ERROR","to no puede ser anterior a from");
   const spanDays=Math.round((Date.parse(toStr+"T00:00:00Z")-Date.parse(fromStr+"T00:00:00Z"))/864e5)+1;
   if(spanDays>RANGE_MAX_DAYS)throw new ClinicalError("VALIDATION_ERROR",`el rango no puede exceder ${RANGE_MAX_DAYS} días`);
   const fromIso=dayWindow(fromStr).fromIso,toIso=dayWindow(toStr).toIso;
   const appointments=await agendaForDate(ctx,fromIso,toIso);
   return NextResponse.json({from:fromStr,to:toStr,appointments,counts:agendaCounts(appointments)},{status:200});
  }
  const dateStr=url.searchParams.get("date")||dayOf(new Date().toISOString());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))throw new ClinicalError("VALIDATION_ERROR","date debe ser YYYY-MM-DD");
  const{fromIso,toIso}=dayWindow(dateStr);
  const appointments=await agendaForDate(ctx,fromIso,toIso);
  return NextResponse.json({date:dateStr,appointments,counts:agendaCounts(appointments)},{status:200});
 });
}
function agendaCounts(appointments:Awaited<ReturnType<typeof agendaForDate>>){
 return{programadas:appointments.length,
  atendidas:appointments.filter(a=>a.status==="COMPLETED").length,
  enEspera:appointments.filter(a=>a.status==="CHECKED_IN").length,
  canceladas:appointments.filter(a=>a.status==="CANCELLED"||a.status==="NO_SHOW").length};
}
