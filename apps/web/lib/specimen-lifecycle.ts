import{z}from"zod";
import{foldSpecimen,assertSpecimenTransition}from"../../../packages/specimen-fold/src";
import{requireRegisteredPatient}from"./runtime/read-models/patient";
import{parseJson}from"./http-command";
import{createCommand,transitionCommand}from"./command/aggregate-command";
// EPIC AF — Ciclo de vida de una muestra: COLLECTED -> IN_TRANSIT -> RECEIVED -> {RESULTED, REJECTED}.
// Cadena de custodia pre-analítica; recolectar/enviar/recibir/procesar/rechazar exige scope specimen:write.
// Lote 11 (ADR-0300): el protocolo (sesión, autorización, cabeceras, replay, máquina de estados, kernel) vive en el pipeline.
const SPECIMEN={aggregateType:"Specimen",idField:"specimenId",fold:foldSpecimen,assertTransition:assertSpecimenTransition,notFound:"Specimen not found"} as const;
const WRITE={scope:"specimen:write",purpose:"TREATMENT"} as const;

export const CollectBody=z.object({specimenId:z.string().uuid(),patientId:z.string().uuid(),specimenType:z.enum(["BLOOD","URINE","TISSUE","SWAB","CSF","STOOL"]),orderId:z.string().uuid().optional(),occurredAt:z.string().datetime()});
export async function handleSpecimenCollect(req:Request):Promise<Response>{
 return createCommand(req,WRITE,SPECIMEN,async({ctx})=>{
  const b=await parseJson(req,CollectBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  return{aggregateId:b.specimenId,state:"COLLECTED",eventType:"SPECIMEN_COLLECTED",payload:{kind:"COLLECTED",patientId:b.patientId,specimenType:b.specimenType,orderId:b.orderId??""},occurredAt:b.occurredAt,topic:"specimen.collected"};
 });
}

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleSpecimenTransit(req:Request,specimenId:string):Promise<Response>{
 return transitionCommand(req,WRITE,SPECIMEN,specimenId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"IN_TRANSIT",eventType:"SPECIMEN_IN_TRANSIT",payload:{kind:"IN_TRANSIT"},occurredAt:b.occurredAt,topic:"specimen.in_transit"};});
}
export async function handleSpecimenReceipt(req:Request,specimenId:string):Promise<Response>{
 return transitionCommand(req,WRITE,SPECIMEN,specimenId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"RECEIVED",eventType:"SPECIMEN_RECEIVED",payload:{kind:"RECEIVED"},occurredAt:b.occurredAt,topic:"specimen.received"};});
}
export async function handleSpecimenResult(req:Request,specimenId:string):Promise<Response>{
 return transitionCommand(req,WRITE,SPECIMEN,specimenId,async()=>{const b=await parseJson(req,WhenBody);
  return{to:"RESULTED",eventType:"SPECIMEN_RESULTED",payload:{kind:"RESULTED"},occurredAt:b.occurredAt,topic:"specimen.resulted"};});
}
export const RejectBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleSpecimenRejection(req:Request,specimenId:string):Promise<Response>{
 return transitionCommand(req,WRITE,SPECIMEN,specimenId,async()=>{const b=await parseJson(req,RejectBody);
  return{to:"REJECTED",eventType:"SPECIMEN_REJECTED",payload:{kind:"REJECTED",reason:b.reason},occurredAt:b.occurredAt,topic:"specimen.rejected"};});
}
