import{z}from"zod";
import{foldAdmission,assertAdmissionTransition}from"../../../packages/admission-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC AE — Ciclo de vida del internamiento: ADMITTED -> {TRANSFERRED*, DISCHARGED, CANCELLED}.
// Censo de hospitalización; admitir/trasladar/dar de alta/cancelar exige scope admission:write.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const ADMISSION={aggregateType:"Admission",idField:"admissionId",fold:foldAdmission,assertTransition:assertAdmissionTransition,notFound:"Admission not found"} as const;
const WRITE={scope:"admission:write",purpose:"TREATMENT"} as const;

export const AdmitBody=z.object({admissionId:z.string().uuid(),patientId:z.string().uuid(),unit:z.enum(["ER","WARD","ICU","OR","MATERNITY","PEDIATRICS"]),reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAdmissionAdmit(req:Request):Promise<Response>{
 return createCommand(req,WRITE,ADMISSION,async({ctx})=>{
  const b=await parseJson(req,AdmitBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.admissionId,state:"ADMITTED",eventType:"ADMISSION_ADMITTED",payload:{kind:"ADMITTED",patientId:b.patientId,unit:b.unit,reason:b.reason},occurredAt:b.occurredAt,topic:"admission.admitted",extra:{unit:b.unit}};
 });
}

export const TransferBody=z.object({unit:z.enum(["ER","WARD","ICU","OR","MATERNITY","PEDIATRICS"]),occurredAt:z.string().datetime()});
export async function handleAdmissionTransfer(req:Request,admissionId:string):Promise<Response>{
 return transitionCommand(req,WRITE,ADMISSION,admissionId,async()=>{const b=await parseJson(req,TransferBody);
  return{to:"TRANSFERRED",eventType:"ADMISSION_TRANSFERRED",payload:{kind:"TRANSFERRED",unit:b.unit},occurredAt:b.occurredAt,topic:"admission.transferred"};});
}
export const DischargeBody=z.object({disposition:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAdmissionDischarge(req:Request,admissionId:string):Promise<Response>{
 return transitionCommand(req,WRITE,ADMISSION,admissionId,async()=>{const b=await parseJson(req,DischargeBody);
  return{to:"DISCHARGED",eventType:"ADMISSION_DISCHARGED",payload:{kind:"DISCHARGED",disposition:b.disposition},occurredAt:b.occurredAt,topic:"admission.discharged"};});
}
export const CancelBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleAdmissionCancellation(req:Request,admissionId:string):Promise<Response>{
 return transitionCommand(req,WRITE,ADMISSION,admissionId,async()=>{const b=await parseJson(req,CancelBody);
  return{to:"CANCELLED",eventType:"ADMISSION_CANCELLED",payload:{kind:"CANCELLED",reason:b.reason},occurredAt:b.occurredAt,topic:"admission.cancelled"};});
}
