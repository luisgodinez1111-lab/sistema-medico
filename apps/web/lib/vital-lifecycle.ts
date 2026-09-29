import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldVital,assertVitalTransition,type FoldedVital,type VitalState}from"../../../packages/vital-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateStream,patientDemographics,requireRegisteredPatient}from"./clinical-runtime";
import{ageInYears}from"../../../packages/prescription-safety/src";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{classifyVital,normalizeVitalMeasure,type VitalStatus}from"../../../packages/lab-reference/src";
// EPIC W — Ciclo de vida de una observación de signo vital: RECORDED -> {AMENDED, ENTERED_IN_ERROR}.
// EPIC AN (profundidad): cada valor se interpreta contra rangos de referencia (NORMAL/ABNORMAL/CRITICAL).
// El valor vigente es append-only: cada corrección genera un evento nuevo (scope vital:write).
// EPIC AQ: critical flag derivado del valor real alimenta closed-loop de signos vitales críticos.
const AGG="VitalSign";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"vital:write",purpose:"TREATMENT"});
}

export const RecordBody=z.object({vitalId:z.string().uuid(),patientId:z.string().uuid(),vitalType:z.enum(["BP","HR","TEMP","SPO2","WEIGHT","HEIGHT","RESP"]),value:z.string().min(1),unit:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleVitalRecord(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,RecordBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  // Auditoría C-13: (1) un valor físicamente imposible se RECHAZA (no se guarda como "UNKNOWN"); (2) la interpretación
  // depende de la EDAD del paciente (FR 45 es normal en un lactante y crítica en un adulto). La edad usada queda en el evento.
  // Auditoría R03-09/R03-11: la UNIDAD se reconoce y se convierte a la canónica ANTES de interpretar y de guardar. Una
  // unidad no reconocida es un rechazo, no un dato: el expediente no puede contener «150» sin saber si son kg o libras.
  const m=normalizeVitalMeasure(b.vitalType,b.value,b.unit);
  if(!m.ok)throw new ClinicalError("VALIDATION_ERROR",m.message,{vitalType:b.vitalType,reason:m.reason});
  const demo=await patientDemographics(ctx,b.patientId);
  const ageYears=demo?.birthDate?ageInYears(demo.birthDate,b.occurredAt):undefined;
  const a=classifyVital(b.vitalType,m.canonicalValue,{ageYears});
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.vitalId,expectedVersion:0,eventType:"VITAL_RECORDED",payload:{kind:"RECORDED",patientId:b.patientId,vitalType:b.vitalType,value:b.value,unit:b.unit,canonicalValue:m.canonicalValue,canonicalUnit:m.canonicalUnit,status:a.status,critical:a.critical,interpretation:a.interpretation,...(ageYears!==undefined?{ageYearsAtRecording:ageYears}:{}),...(a.ageBand?{ageBand:a.ageBand}:{})},occurredAt:b.occurredAt,topic:"vital.recorded"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({vitalId:b.vitalId,state:"RECORDED",status:a.status,critical:a.critical,interpretation:a.interpretation,canonicalValue:m.canonicalValue,canonicalUnit:m.canonicalUnit,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,vitalId:string){
 const{claims,ctx}=resolveVerified(req);authz(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldVital(await readAggregateStream(ctx,AGG,vitalId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Vital sign not found");
 return{ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,vitalId:string,folded:FoldedVital,to:VitalState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string,extra:Record<string,unknown>={}){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:vitalId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertVitalTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({vitalId,state:to,...extra,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
}

export const AmendBody=z.object({value:z.string().min(1),unit:z.string().min(1),reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleVitalAmendment(req:Request,vitalId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,vitalId);const b=await parseJson(req,AmendBody);
  const m=normalizeVitalMeasure(folded.vitalType,b.value,b.unit);
  if(!m.ok)throw new ClinicalError("VALIDATION_ERROR",m.message,{vitalType:folded.vitalType,reason:m.reason});
  const demo=await patientDemographics(ctx,folded.patientId);
  const ageYears=demo?.birthDate?ageInYears(demo.birthDate,b.occurredAt):undefined;
  const a=classifyVital(folded.vitalType,m.canonicalValue,{ageYears});
  return await commit(ctx,idempotencyKey,expectedVersion,vitalId,folded,"AMENDED","VITAL_AMENDED",{kind:"AMENDED",value:b.value,unit:b.unit,canonicalValue:m.canonicalValue,canonicalUnit:m.canonicalUnit,reason:b.reason,status:a.status,critical:a.critical,interpretation:a.interpretation,...(ageYears!==undefined?{ageYearsAtRecording:ageYears}:{})},b.occurredAt,"vital.amended",{status:a.status,critical:a.critical,interpretation:a.interpretation});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ErrorBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleVitalErrorMark(req:Request,vitalId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,vitalId);const b=await parseJson(req,ErrorBody);
  return await commit(ctx,idempotencyKey,expectedVersion,vitalId,folded,"ENTERED_IN_ERROR","VITAL_ENTERED_IN_ERROR",{kind:"ENTERED_IN_ERROR",reason:b.reason},b.occurredAt,"vital.entered_in_error");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
