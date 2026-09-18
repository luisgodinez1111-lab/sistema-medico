import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldAppointment,assertAppointmentTransition,type FoldedAppointment,type AppointmentState}from"../../../packages/appointment-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC U — Ciclo de vida de la cita: SCHEDULED -> CHECKED_IN -> COMPLETED (o CANCELLED/NO_SHOW).
// Agenda: agendar/registrar llegada/completar/cancelar/marcar inasistencia exige scope appointment:write.
const AGG="Appointment";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"appointment:write",purpose:"TREATMENT"});
}

// EPIC CM — agenda enriquecida: fin, consultorio y tipo de cita (opcionales, retrocompatibles).
const APPT_TYPES=["CONSULTA_GENERAL","CONTROL","PRIMERA_VEZ","PROCEDIMIENTO","VACUNACION","RESULTADOS","URGENCIA"] as const;
const ScheduleBody=z.object({appointmentId:z.string().uuid(),patientId:z.string().uuid(),startAt:z.string().datetime(),reason:z.string().min(1),occurredAt:z.string().datetime(),
 endAt:z.string().datetime().optional(),consultorio:z.string().trim().max(60).optional(),apptType:z.enum(APPT_TYPES).optional()});
export async function handleAppointmentSchedule(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ScheduleBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.appointmentId,expectedVersion:0,eventType:"APPOINTMENT_SCHEDULED",payload:{kind:"SCHEDULED",patientId:b.patientId,startAt:b.startAt,reason:b.reason,...(b.endAt?{endAt:b.endAt}:{}),...(b.consultorio?{consultorio:b.consultorio}:{}),...(b.apptType?{apptType:b.apptType}:{})},occurredAt:b.occurredAt,topic:"appointment.scheduled"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({appointmentId:b.appointmentId,state:"SCHEDULED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,appointmentId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldAppointment(await readAggregateEvents(ctx,appointmentId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Appointment not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,appointmentId:string,folded:FoldedAppointment,to:AppointmentState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:appointmentId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertAppointmentTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({appointmentId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleAppointmentCheckIn(req:Request,appointmentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,appointmentId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,appointmentId,folded,"CHECKED_IN","APPOINTMENT_CHECKED_IN",{kind:"CHECKED_IN"},b.occurredAt,"appointment.checked_in");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleAppointmentCompletion(req:Request,appointmentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,appointmentId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,appointmentId,folded,"COMPLETED","APPOINTMENT_COMPLETED",{kind:"COMPLETED"},b.occurredAt,"appointment.completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleAppointmentNoShow(req:Request,appointmentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,appointmentId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,appointmentId,folded,"NO_SHOW","APPOINTMENT_NO_SHOW",{kind:"NO_SHOW"},b.occurredAt,"appointment.no_show");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAppointmentCancellation(req:Request,appointmentId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,appointmentId);const b=await parseJson(req,CancelBody);
  return await commit(ctx,idempotencyKey,expectedVersion,appointmentId,folded,"CANCELLED","APPOINTMENT_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"appointment.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
