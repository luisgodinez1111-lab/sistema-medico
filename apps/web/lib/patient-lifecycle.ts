import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldPatient,assertPatientTransition,type FoldedPatient,type PatientStatus}from"../../../packages/patient-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,listPatients,clampLimit,findPatientDuplicate,patientDemographics}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{validateCurp,normalizeCurp,normalizeName,isMinor,CURP_ISSUE_ES}from"../../../packages/mx-identity/src";
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
// Auditoría 2026-09-19 (L-06): identidad robusta al alta.
//  · la CURP, si se da, se valida (formato oficial, dígito verificador y coherencia con fecha de nacimiento y sexo);
//  · duplicados: misma CURP en el tenant -> 409 siempre (es la misma persona); mismo nombre normalizado + misma fecha de
//    nacimiento -> 409 salvo `confirmNotDuplicate:true` (homónimos reales existen; la decisión queda en el evento);
//  · `guardian` (tutor / representante legal) opcional; para un MENOR de edad su ausencia se declara en la respuesta
//    (`warnings`) y el consentimiento informado de un menor exige tutor registrado (consent-lifecycle).
const Guardian=z.object({name:z.string().trim().min(3).max(160),relationship:z.string().trim().min(2).max(60),phone:z.string().trim().max(30).optional()}).strict();
const RegisterBody=z.object({patientId:z.string().uuid(),name:z.string().trim().min(1).max(200),birthDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,"birthDate must be YYYY-MM-DD"),sexAtBirth:z.enum(["FEMALE","MALE","INTERSEX","UNKNOWN"]),occurredAt:z.string().datetime(),
 curp:z.string().trim().max(18).optional(),phone:z.string().trim().max(30).optional(),email:z.string().trim().max(120).optional(),address:z.string().trim().max(200).optional(),occupation:z.string().trim().max(120).optional(),maritalStatus:z.string().trim().max(40).optional(),
 guardian:Guardian.optional(),confirmNotDuplicate:z.boolean().optional()});
const extra=(b:{curp?:string|undefined;phone?:string|undefined;email?:string|undefined;address?:string|undefined;occupation?:string|undefined;maritalStatus?:string|undefined;guardian?:z.infer<typeof Guardian>|undefined})=>({...(b.curp?{curp:normalizeCurp(b.curp)}:{}),...(b.phone?{phone:b.phone}:{}),...(b.email?{email:b.email}:{}),...(b.address?{address:b.address}:{}),...(b.occupation?{occupation:b.occupation}:{}),...(b.maritalStatus?{maritalStatus:b.maritalStatus}:{}),...(b.guardian?{guardian:b.guardian}:{})});
export async function handlePatientRegister(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authzWrite(claims);
  const idempotencyKey=req.headers.get("idempotency-key");if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,RegisterBody);
  const bd=new Date(`${b.birthDate}T00:00:00Z`);
  if(Number.isNaN(bd.getTime())||bd.toISOString().slice(0,10)!==b.birthDate)throw new ClinicalError("VALIDATION_ERROR","birthDate no es una fecha válida");
  if(bd.getTime()>Date.parse(b.occurredAt))throw new ClinicalError("VALIDATION_ERROR","birthDate no puede ser posterior a la fecha de registro");
  if(b.curp){const v=validateCurp(b.curp,{birthDate:b.birthDate,sexAtBirth:b.sexAtBirth});if(!v.ok)throw new ClinicalError("VALIDATION_ERROR",CURP_ISSUE_ES[v.issue],{curpIssue:v.issue});}
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.patientId,expectedVersion:0,eventType:"PATIENT_REGISTERED",payload:{kind:"REGISTERED",name:b.name,birthDate:b.birthDate,sexAtBirth:b.sexAtBirth,...extra(b),...(b.confirmNotDuplicate?{confirmedNotDuplicate:true}:{})},occurredAt:b.occurredAt,topic:"patient.registered"});
  let result=await lookupReplay(ctx,cmd);
  if(!result){
   const dup=await findPatientDuplicate(ctx,{curp:b.curp?normalizeCurp(b.curp):undefined,normalizedName:normalizeName(b.name),birthDate:b.birthDate});
   if(dup&&dup.patientId!==b.patientId&&(dup.by==="CURP"||!b.confirmNotDuplicate))throw new ClinicalError("CONFLICT",dup.by==="CURP"
    ?"Ya existe un paciente con esta CURP en el consultorio: es la misma persona; abra su expediente en lugar de duplicarlo"
    :"Ya existe un paciente con el mismo nombre y fecha de nacimiento; si es una persona distinta, confirme con confirmNotDuplicate",
    {duplicateOf:dup.patientId,duplicateBy:dup.by});
   result=await runClinicalCommand(ctx,cmd);
  }
  const r=result.response as{version:number;auditHash?:string};
  const minor=isMinor(b.birthDate,b.occurredAt)===true;
  const warnings=minor&&!b.guardian?["MINOR_WITHOUT_GUARDIAN"]:[];
  return NextResponse.json({patientId:b.patientId,status:"ACTIVE",name:b.name,isMinor:minor,...(warnings.length?{warnings}:{}),version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handlePatientList(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authzRead(claims);
  // Auditoría S-08: ?limit=1..500 (100 por defecto), ?cursor= (del nextCursor anterior), ?q= (prefijo de nombre o CURP).
  const u=new URL(req.url);
  const page=await listPatients(ctx,{limit:clampLimit(u.searchParams.get("limit")),cursor:u.searchParams.get("cursor"),q:u.searchParams.get("q")?.slice(0,80)??null});
  return NextResponse.json({patients:page.items,nextCursor:page.nextCursor,total:page.total},{status:200});
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
 curp:z.string().trim().max(18).optional(),phone:z.string().trim().max(30).optional(),email:z.string().trim().max(120).optional(),address:z.string().trim().max(200).optional(),occupation:z.string().trim().max(120).optional(),maritalStatus:z.string().trim().max(40).optional(),
 guardian:Guardian.optional()});
export async function handlePatientAmend(req:Request,patientId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authzWrite(claims);
  const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
  const folded=foldPatient(await readAggregateEvents(ctx,patientId));
  if(!folded.exists)throw new ClinicalError("NOT_FOUND","Patient not found");
  const b=await parseJson(req,AmendBody);
  // L-06: la CURP corregida se valida contra los datos VIGENTES (o los que se corrigen en la misma enmienda).
  if(b.curp){const cur=await patientDemographics(ctx,patientId);const bdEff=b.birthDate??cur?.birthDate;const sxEff=b.sexAtBirth??cur?.sexAtBirth;
   const v=validateCurp(b.curp,{...(bdEff!==undefined?{birthDate:bdEff}:{}),...(sxEff!==undefined?{sexAtBirth:sxEff}:{})});
   if(!v.ok)throw new ClinicalError("VALIDATION_ERROR",CURP_ISSUE_ES[v.issue],{curpIssue:v.issue});
   const dup=await findPatientDuplicate(ctx,{curp:normalizeCurp(b.curp)});
   if(dup&&dup.patientId!==patientId&&dup.by==="CURP")throw new ClinicalError("CONFLICT","Esa CURP ya pertenece a otro paciente del consultorio",{duplicateOf:dup.patientId,duplicateBy:"CURP"});}
  const fields={...(b.name!==undefined?{name:b.name}:{}),...(b.birthDate!==undefined?{birthDate:b.birthDate}:{}),...(b.sexAtBirth!==undefined?{sexAtBirth:b.sexAtBirth}:{}),...extra(b)};
  if(Object.keys(fields).length===0)throw new ClinicalError("PRECONDITION_REQUIRED","No fields to amend");
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:patientId,expectedVersion,eventType:"PATIENT_AMENDED",payload:{kind:"AMENDED",...fields},occurredAt:b.occurredAt,topic:"patient.amended"});
  let result=await lookupReplay(ctx,cmd);if(!result)result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({patientId,status:folded.status,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
