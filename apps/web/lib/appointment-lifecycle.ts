import{z}from"zod";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldAppointment,assertAppointmentTransition}from"../../../packages/appointment-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{agendaForDate}from"./runtime/read-models/scheduling";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC U — Ciclo de vida de la cita: SCHEDULED -> CHECKED_IN -> COMPLETED (o CANCELLED/NO_SHOW).
// Agenda: agendar/registrar llegada/completar/cancelar/marcar inasistencia exige scope appointment:write.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const APPT={aggregateType:"Appointment",idField:"appointmentId",fold:foldAppointment,assertTransition:assertAppointmentTransition,notFound:"Appointment not found"} as const;
const WRITE={scope:"appointment:write",purpose:"TREATMENT"} as const;

// EPIC CM — agenda enriquecida: fin, consultorio y tipo de cita (opcionales, retrocompatibles).
const APPT_TYPES=["CONSULTA_GENERAL","CONTROL","PRIMERA_VEZ","PROCEDIMIENTO","VACUNACION","RESULTADOS","URGENCIA"] as const;
export const ScheduleBody=z.object({appointmentId:z.string().uuid(),patientId:z.string().uuid(),startAt:z.string().datetime(),reason:z.string().min(1),occurredAt:z.string().datetime(),
 endAt:z.string().datetime().optional(),consultorio:z.string().trim().max(60).optional(),apptType:z.enum(APPT_TYPES).optional()});
// Auditoría 2026-09-19 (L-12): control de traslape y doble reserva. Reglas:
//  · toda cita ocupa un intervalo [startAt, endAt); sin `endAt` se asume DEFAULT_SLOT_MINUTES; `endAt` debe ser posterior y
//    la duración no supera MAX_SLOT_HOURS (un error de captura no bloquea la agenda de un día entero);
//  · el RECURSO que no puede doblarse es el consultorio: dos citas activas (SCHEDULED o CHECKED_IN) del mismo consultorio no
//    se traslapan; sin consultorio declarado, se considera el consultorio único del tenant (el caso del consultorio
//    individual). Además, un mismo PACIENTE no tiene dos citas activas traslapadas aunque sea en consultorios distintos;
//  · las citas COMPLETED / CANCELLED / NO_SHOW liberan el hueco.
// Los instantes llegan en UTC ("Z"); el día civil de la agenda lo calcula el lector con la zona del consultorio (clinic-time).
export const DEFAULT_SLOT_MINUTES=30;
export const MAX_SLOT_HOURS=8;
const ACTIVE_STATES=new Set(["SCHEDULED","CHECKED_IN"]);
export type SlotConflict=Readonly<{appointmentId:string;startAt:string;endAt:string;reason:"CONSULTORIO"|"PATIENT"}>;
// Puro: decide si el intervalo pedido choca con alguna cita ACTIVA (mismo consultorio o mismo paciente).
export function findSlotConflict(candidate:{startAt:string;endAt:string;consultorio:string|null;patientId:string},existing:readonly{appointmentId:string;startAt:string;endAt:string|null;consultorio:string|null;patientId:string;status:string}[]):SlotConflict|null{
 const s=Date.parse(candidate.startAt),e=Date.parse(candidate.endAt);
 for(const a of existing){
  if(!ACTIVE_STATES.has(a.status))continue;
  const as=Date.parse(a.startAt),ae=a.endAt?Date.parse(a.endAt):as+DEFAULT_SLOT_MINUTES*60000;
  if(!(s<ae&&as<e))continue; // sin intersección de intervalos semiabiertos
  if(a.patientId===candidate.patientId)return{appointmentId:a.appointmentId,startAt:a.startAt,endAt:new Date(ae).toISOString(),reason:"PATIENT"};
  if((a.consultorio??"")===(candidate.consultorio??""))return{appointmentId:a.appointmentId,startAt:a.startAt,endAt:new Date(ae).toISOString(),reason:"CONSULTORIO"};
 }
 return null;
}
const hhmm=(iso:string)=>new Date(iso).toLocaleTimeString("es-MX",{timeZone:"America/Mexico_City",hour:"2-digit",minute:"2-digit",hour12:false});
export async function handleAppointmentSchedule(req:Request):Promise<Response>{
 return createCommand(req,WRITE,APPT,async({ctx})=>{
  const b=await parseJson(req,ScheduleBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const start=Date.parse(b.startAt);const endAt=b.endAt??new Date(start+DEFAULT_SLOT_MINUTES*60000).toISOString();const end=Date.parse(endAt);
  if(end<=start)throw new ClinicalError("VALIDATION_ERROR","endAt debe ser posterior a startAt");
  if(end-start>MAX_SLOT_HOURS*3600000)throw new ClinicalError("VALIDATION_ERROR",`La cita no puede durar más de ${MAX_SLOT_HOURS} horas`);
  // Candidatas a traslape: citas que EMPIEZAN en la ventana [start − MAX, end + MAX) (una cita más larga que MAX no existe).
  const window=await agendaForDate(ctx,new Date(start-MAX_SLOT_HOURS*3600000).toISOString(),new Date(end+MAX_SLOT_HOURS*3600000).toISOString());
  const conflict=findSlotConflict({startAt:b.startAt,endAt,consultorio:b.consultorio??null,patientId:b.patientId},window.filter(a=>a.appointmentId!==b.appointmentId));
  if(conflict)throw new ClinicalError("CONFLICT",conflict.reason==="PATIENT"
   ?`El paciente ya tiene una cita activa que se traslapa (${hhmm(conflict.startAt)}–${hhmm(conflict.endAt)})`
   :`Traslape en ${b.consultorio?`el consultorio ${b.consultorio}`:"la agenda"}: ya hay una cita activa de ${hhmm(conflict.startAt)} a ${hhmm(conflict.endAt)}`,
   {conflictWith:conflict.appointmentId,conflictReason:conflict.reason});
  return{aggregateId:b.appointmentId,state:"SCHEDULED",eventType:"APPOINTMENT_SCHEDULED",payload:{kind:"SCHEDULED",patientId:b.patientId,startAt:b.startAt,endAt,reason:b.reason,...(b.consultorio?{consultorio:b.consultorio}:{}),...(b.apptType?{apptType:b.apptType}:{})},occurredAt:b.occurredAt,topic:"appointment.scheduled"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleAppointmentCheckIn(req:Request,appointmentId:string):Promise<Response>{
 return transitionCommand(req,WRITE,APPT,appointmentId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"CHECKED_IN",eventType:"APPOINTMENT_CHECKED_IN",payload:{kind:"CHECKED_IN"},occurredAt:b.occurredAt,topic:"appointment.checked_in"};});
}
export async function handleAppointmentCompletion(req:Request,appointmentId:string):Promise<Response>{
 return transitionCommand(req,WRITE,APPT,appointmentId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"COMPLETED",eventType:"APPOINTMENT_COMPLETED",payload:{kind:"COMPLETED"},occurredAt:b.occurredAt,topic:"appointment.completed"};});
}
export async function handleAppointmentNoShow(req:Request,appointmentId:string):Promise<Response>{
 return transitionCommand(req,WRITE,APPT,appointmentId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"NO_SHOW",eventType:"APPOINTMENT_NO_SHOW",payload:{kind:"NO_SHOW"},occurredAt:b.occurredAt,topic:"appointment.no_show"};});
}
export const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAppointmentCancellation(req:Request,appointmentId:string):Promise<Response>{
 return transitionCommand(req,WRITE,APPT,appointmentId,async()=>{const b=await parseJson(req,CancelBody);
  return{to:"CANCELLED",eventType:"APPOINTMENT_CANCELLED",payload:{kind:"CANCELLED",reason:b.reason},occurredAt:b.occurredAt,topic:"appointment.cancelled"};});
}
