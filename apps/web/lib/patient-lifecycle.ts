import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldPatient,assertPatientTransition,type FoldedPatient,type PatientStatus}from"../../../packages/patient-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,listPatients}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC S — Registro de pacientes (agregado longitudinal): REGISTERED(ACTIVE) <-> INACTIVE; -> DECEASED.
// El nombre es PHI: en payload (RLS) y en la respuesta al clínico autorizado; nunca en logs.
const AGG="Patient";
function authzWrite(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:write",purpose:"TREATMENT"});
}
function authzRead(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"patient:read",purpose:"TREATMENT"});
}

// EPIC CL — datos demográficos ampliados (México): CURP + contacto. Opcionales y retrocompatibles.
const RegisterBody=z.object({patientId:z.string().uuid(),name:z.string().min(1),birthDate:z.string().min(1),sexAtBirth:z.enum(["FEMALE","MALE","INTERSEX","UNKNOWN"]),occurredAt:z.string().datetime(),
 curp:z.string().trim().max(18).optional(),phone:z.string().trim().max(30).optional(),email:z.string().trim().max(120).optional(),address:z.string().trim().max(200).optional(),occupation:z.string().trim().max(120).optional(),maritalStatus:z.string().trim().max(40).optional()});
const extra=(b:{curp?:string|undefined;phone?:string|undefined;email?:string|undefined;address?:string|undefined;occupation?:string|undefined;maritalStatus?:string|undefined})=>({...(b.curp?{curp:b.curp.toUpperCase()}:{}),...(b.phone?{phone:b.phone}:{}),...(b.email?{email:b.email}:{}),...(b.address?{address:b.address}:{}),...(b.occupation?{occupation:b.occupation}:{}),...(b.maritalStatus?{maritalStatus:b.maritalStatus}:{})});
export async function handlePatientRegister(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authzWrite(claims);
  const idempotencyKey=req.headers.get("idempotency-key");if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,RegisterBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.patientId,expectedVersion:0,eventType:"PATIENT_REGISTERED",payload:{kind:"REGISTERED",name:b.name,birthDate:b.birthDate,sexAtBirth:b.sexAtBirth,...extra(b)},occurredAt:b.occurredAt,topic:"patient.registered"});
  const result=await runClinicalCommand(ctx,cmd);const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({patientId:b.patientId,status:"ACTIVE",name:b.name,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handlePatientList(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authzRead(claims);
  const patients=await listPatients(ctx);
  return NextResponse.json({patients},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
async function loadForTransition(req:Request,patientId:string){
 const{claims,ctx}=resolveVerified(req);authzWrite(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldPatient(await readAggregateEvents(ctx,patientId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Patient not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,patientId:string,folded:FoldedPatient,to:PatientStatus,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:patientId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertPatientTransition(folded.status,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({patientId,status:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}
const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handlePatientDeactivation(req:Request,patientId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,patientId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,patientId,folded,"INACTIVE","PATIENT_DEACTIVATED",{kind:"DEACTIVATED"},b.occurredAt,"patient.deactivated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handlePatientReactivation(req:Request,patientId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,patientId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,patientId,folded,"ACTIVE","PATIENT_REACTIVATED",{kind:"REACTIVATED"},b.occurredAt,"patient.reactivated");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// EPIC CL/UI — Corrección de datos del paciente (AMENDED): sobreescribe sólo los campos provistos; no cambia el estado.
// Concurrencia optimista (If-Match). El nombre/CURP siguen siendo PHI (payload RLS, nunca en logs).
const AmendBody=z.object({name:z.string().min(1).optional(),birthDate:z.string().min(1).optional(),sexAtBirth:z.enum(["FEMALE","MALE","INTERSEX","UNKNOWN"]).optional(),occurredAt:z.string().datetime(),
 curp:z.string().trim().max(18).optional(),phone:z.string().trim().max(30).optional(),email:z.string().trim().max(120).optional(),address:z.string().trim().max(200).optional(),occupation:z.string().trim().max(120).optional(),maritalStatus:z.string().trim().max(40).optional()});
export async function handlePatientAmend(req:Request,patientId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authzWrite(claims);
  const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
  const folded=foldPatient(await readAggregateEvents(ctx,patientId));
  if(!folded.exists)throw new ClinicalError("NOT_FOUND","Patient not found");
  const b=await parseJson(req,AmendBody);
  const fields={...(b.name!==undefined?{name:b.name}:{}),...(b.birthDate!==undefined?{birthDate:b.birthDate}:{}),...(b.sexAtBirth!==undefined?{sexAtBirth:b.sexAtBirth}:{}),...extra(b)};
  if(Object.keys(fields).length===0)throw new ClinicalError("PRECONDITION_REQUIRED","No fields to amend");
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:patientId,expectedVersion,eventType:"PATIENT_AMENDED",payload:{kind:"AMENDED",...fields},occurredAt:b.occurredAt,topic:"patient.amended"});
  let result=await lookupReplay(ctx,cmd);if(!result)result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({patientId,status:folded.status,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
