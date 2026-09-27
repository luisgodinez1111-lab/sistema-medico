import{z}from"zod";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldVital,assertVitalTransition}from"../../../packages/vital-fold/src";
import{patientDemographics,requireRegisteredPatient}from"./runtime/read-models/patient";
import{ageInYears}from"../../../packages/prescription-safety/src";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
import{classifyVital,vitalPlausible}from"../../../packages/lab-reference/src";
// EPIC W — Ciclo de vida de una observación de signo vital: RECORDED -> {AMENDED, ENTERED_IN_ERROR}.
// EPIC AN (profundidad): cada valor se interpreta contra rangos de referencia (NORMAL/ABNORMAL/CRITICAL).
// El valor vigente es append-only: cada corrección genera un evento nuevo (scope vital:write).
// EPIC AQ: critical flag derivado del valor real alimenta closed-loop de signos vitales críticos.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline;
// la clasificación (status/critical/interpretation) viaja en `extra`, entre el estado y `version`, como antes.
const VITAL={aggregateType:"VitalSign",idField:"vitalId",fold:foldVital,assertTransition:assertVitalTransition,notFound:"Vital sign not found"} as const;
const WRITE={scope:"vital:write",purpose:"TREATMENT"} as const;

export const RecordBody=z.object({vitalId:z.string().uuid(),patientId:z.string().uuid(),vitalType:z.enum(["BP","HR","TEMP","SPO2","WEIGHT","HEIGHT","RESP"]),value:z.string().min(1),unit:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleVitalRecord(req:Request):Promise<Response>{
 return createCommand(req,WRITE,VITAL,async({ctx})=>{
  const b=await parseJson(req,RecordBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  // Auditoría C-13: (1) un valor físicamente imposible se RECHAZA (no se guarda como "UNKNOWN"); (2) la interpretación
  // depende de la EDAD del paciente (FR 45 es normal en un lactante y crítica en un adulto). La edad usada queda en el evento.
  const pl=vitalPlausible(b.vitalType,b.value);
  if(!pl.ok)throw new ClinicalError("VALIDATION_ERROR",pl.message,{vitalType:b.vitalType});
  const demo=await patientDemographics(ctx,b.patientId);
  const ageYears=demo?.birthDate?ageInYears(demo.birthDate,b.occurredAt):undefined;
  const a=classifyVital(b.vitalType,b.value,{ageYears});
  return{aggregateId:b.vitalId,state:"RECORDED",eventType:"VITAL_RECORDED",payload:{kind:"RECORDED",patientId:b.patientId,vitalType:b.vitalType,value:b.value,unit:b.unit,status:a.status,critical:a.critical,interpretation:a.interpretation,...(ageYears!==undefined?{ageYearsAtRecording:ageYears}:{}),...(a.ageBand?{ageBand:a.ageBand}:{})},occurredAt:b.occurredAt,topic:"vital.recorded",extra:{status:a.status,critical:a.critical,interpretation:a.interpretation}};
 });
}

export const AmendBody=z.object({value:z.string().min(1),unit:z.string().min(1),reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleVitalAmendment(req:Request,vitalId:string):Promise<Response>{
 return transitionCommand(req,WRITE,VITAL,vitalId,async({ctx,folded})=>{const b=await parseJson(req,AmendBody);
  const pl=vitalPlausible(folded.vitalType,b.value);
  if(!pl.ok)throw new ClinicalError("VALIDATION_ERROR",pl.message,{vitalType:folded.vitalType});
  const demo=await patientDemographics(ctx,folded.patientId);
  const ageYears=demo?.birthDate?ageInYears(demo.birthDate,b.occurredAt):undefined;
  const a=classifyVital(folded.vitalType,b.value,{ageYears});
  return{to:"AMENDED",eventType:"VITAL_AMENDED",payload:{kind:"AMENDED",value:b.value,unit:b.unit,reason:b.reason,status:a.status,critical:a.critical,interpretation:a.interpretation,...(ageYears!==undefined?{ageYearsAtRecording:ageYears}:{})},occurredAt:b.occurredAt,topic:"vital.amended",extra:{status:a.status,critical:a.critical,interpretation:a.interpretation}};});
}
export const ErrorBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleVitalErrorMark(req:Request,vitalId:string):Promise<Response>{
 return transitionCommand(req,WRITE,VITAL,vitalId,async()=>{const b=await parseJson(req,ErrorBody);
  return{to:"ENTERED_IN_ERROR",eventType:"VITAL_ENTERED_IN_ERROR",payload:{kind:"ENTERED_IN_ERROR",reason:b.reason},occurredAt:b.occurredAt,topic:"vital.entered_in_error"};});
}
