// ⚠️ NOT_WIRED (endurecimiento G / Epic BF): este handler NO está cableado a ninguna ruta (código inalcanzable).
// Ver docs/adjudication/not-wired-registry.json. R6 (IA) EN PAUSA: no activar. No cuenta como capacidad end-to-end.
import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,derivedUuid,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{renderPrescription,verifyPrescription,type PrescriptionClinicalData,BASE_TEMPLATE_V1}from"../../../packages/prescription-studio/src";
// EPIC J — Prescription Studio: visual template renderer over structured clinical data.
// EXEC-0015: Clinical data ≠ visual template ≠ rendered artifact.
// Rendered prescription reproducible from signed clinical data + template version.
// IA never becomes clinical source of truth.

const AGG="PrescriptionArtifact";

function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"prescription:write",purpose:"TREATMENT"});
}

const RenderBody=z.object({medicationId:z.string().uuid(),templateVersion:z.string().default("1.0.0"),occurredAt:z.string().datetime()});

export async function handlePrescriptionRender(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,RenderBody);
  // Leer medicación firmada (PRESCRIBED o ACTIVE) para obtener datos clínicos
  const events=await readAggregateEvents(ctx,b.medicationId);
  if(events.length===0)throw new ClinicalError("NOT_FOUND","Medication not found");
  // Buscar evento PRESCRIBED
  const prescribed=events.find(e=>e.payload["kind"]==="PRESCRIBED");
  if(!prescribed)throw new ClinicalError("VALIDATION_ERROR","Medication must be PRESCRIBED before rendering");
  const proposed=events.find(e=>e.payload["kind"]==="PROPOSED");
  if(!proposed)throw new ClinicalError("VALIDATION_ERROR","Medication must have PROPOSED event");
  // Construir clinicalData desde eventos
  const clinicalData:PrescriptionClinicalData={
   medicationId:b.medicationId,
   patientId:String(proposed?.payload["patientId"]??""),
   prescriberId:String(prescribed.payload["prescriberId"]??""),
   drugCode:String(proposed?.payload["drugCode"]??""),
   drugName:String(proposed?.payload["drugCode"]??""), // TODO: lookup en drug-catalog
   dose:String(proposed?.payload["dose"]??""),
   route:String(proposed?.payload["route"]??""),
   frequency:String(proposed?.payload["frequency"]??""),
   duration:String(proposed?.payload["duration"]??""),
   indication:String(proposed?.payload["indication"]??""),
   prescribedAt:String(prescribed.payload["occurredAt"]??""),
   calculatedDose:String(proposed?.payload["calculatedDose"]??""),
   prescriberSignature:String(prescribed.payload["prescriberId"]??""), // signatureDigest real vendría de signed-record
   contentHash:"", // se calcula en renderPrescription
  };
  // Usar template institucional por defecto
  const template=BASE_TEMPLATE_V1;
  const {artifact,contentHash,templateVersion}=renderPrescription(clinicalData,template);
  // Persistir artifact como evento
  // AUDITORÍA 2026-09-17: aggregateId era `rx-<uuid>` — NO es uuid válido y clinical_events.aggregate_id es
  // uuid NOT NULL -> 22P02 (500) al llamar. Se deriva un uuid DETERMINISTA del medicationId (idempotente:
  // una prescripción por medicación) para conservar la semántica original con un id válido.
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:derivedUuid(b.medicationId,"prescription"),expectedVersion:0,eventType:"PRESCRIPTION_RENDERED",payload:{kind:"RENDERED",medicationId:b.medicationId,artifact,contentHash,templateVersion},occurredAt:b.occurredAt,topic:"prescription.rendered"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({medicationId:b.medicationId,artifact,contentHash,templateVersion,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const VerifyBody=z.object({artifact:z.string().min(1),templateVersion:z.string().default("1.0.0"),occurredAt:z.string().datetime()});

export async function handlePrescriptionVerify(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const b=await parseJson(req,VerifyBody);
  // Leer medicación para obtener clinicalData
  const events=await readAggregateEvents(ctx,b.artifact.substring(0,36)); // medicationId extraído
  if(events.length===0)throw new ClinicalError("NOT_FOUND","Medication not found");
  const prescribed=events.find(e=>e.payload["kind"]==="PRESCRIBED");
  if(!prescribed)throw new ClinicalError("VALIDATION_ERROR","Medication must be PRESCRIBED");
  const proposed=events.find(e=>e.payload["kind"]==="PROPOSED");
  if(!proposed)throw new ClinicalError("VALIDATION_ERROR","Medication must have PROPOSED event");
  const clinicalData:PrescriptionClinicalData={
   medicationId:b.artifact.substring(0,36),
   patientId:String(proposed?.payload["patientId"]??""),
   prescriberId:String(prescribed?.payload["prescriberId"]??""),
   drugCode:String(proposed?.payload["drugCode"]??""),
   drugName:String(proposed?.payload["drugCode"]??""),
   dose:String(proposed?.payload["dose"]??""),
   route:String(proposed?.payload["route"]??""),
   frequency:String(proposed?.payload["frequency"]??""),
   duration:String(proposed?.payload["duration"]??""),
   indication:String(proposed?.payload["indication"]??""),
   prescribedAt:String(prescribed.payload["occurredAt"]??""),
   calculatedDose:String(proposed?.payload["calculatedDose"]??""),
   prescriberSignature:String(prescribed.payload["prescriberId"]??""),
   contentHash:"",
  };
  const template=BASE_TEMPLATE_V1;
  const result=verifyPrescription(b.artifact,clinicalData,template);
  return NextResponse.json({valid:result.valid,errors:result.errors,verifiedAt:b.occurredAt},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}