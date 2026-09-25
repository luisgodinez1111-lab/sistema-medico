import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldTriage,assertTriageTransition,type FoldedTriage,type TriageState}from"../../../packages/triage-fold/src";
import{esiLevel,reassessmentDueAt,ESI_ALGORITHM,REASSESSMENT_SOURCE}from"../../../packages/emergency-triage/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC AH — Ciclo de vida del triage: WAITING -> IN_TRIAGE -> TRIAGED (re-evaluable) -> CLOSED; o LWBS.
// Front-of-house de urgencias; arribar/iniciar/clasificar/cerrar/LWBS exige scope triage:write.
const AGG="Triage";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"triage:write",purpose:"TREATMENT"});
}

export const ArriveBody=z.object({triageId:z.string().uuid(),patientId:z.string().uuid(),chiefComplaint:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTriageArrive(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ArriveBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.triageId,expectedVersion:0,eventType:"TRIAGE_ARRIVED",payload:{kind:"ARRIVED",patientId:b.patientId,chiefComplaint:b.chiefComplaint},occurredAt:b.occurredAt,topic:"triage.arrived"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({triageId:b.triageId,state:"WAITING",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedTriage,TriageState>({aggregateType:AGG,idKey:"triageId",notFound:"Triage not found",fold:foldTriage,assertTransition:assertTriageTransition,authz});
const loadForTransition=(req:Request,triageId:string)=>LIFECYCLE.loadForTransition(req,triageId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,triageId:string,folded:FoldedTriage,to:TriageState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string,extra?:Record<string,unknown>)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,triageId,folded,to,eventType,payload,occurredAt,topic,extra);

export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleTriageStart(req:Request,triageId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,triageId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,triageId,folded,"IN_TRIAGE","TRIAGE_STARTED",{kind:"TRIAGE_STARTED"},b.occurredAt,"triage.started");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// Auditoría 2026-09-19, anexo R02b (R2B-019) — EL NIVEL SE CALCULA CON EL ALGORITMO, no lo teclea nadie.
//
// El cuerpo era `acuity:z.number().int().min(1).max(5)`: un entero libre presentado como ESI. Ahora se reciben los
// DISCRIMINADORES del algoritmo y el nivel es su consecuencia (`packages/emergency-triage`). Tres razones concretas:
//   · Un entero no deja rastro de CÓMO se llegó a él; los discriminadores sí, y quedan en el event store.
//   · El punto D del algoritmo —signos vitales en zona de peligro— es puramente numérico y es el que más se olvida a mano.
//   · «ESI-2» escrito a mano no es comprobable; el nivel derivado sí, y una revisión puede recalcularlo desde el evento.
export const AssessBody=z.object({
 requiresLifeSavingIntervention:z.boolean(),
 highRiskSituation:z.boolean(),
 newConfusionLethargyDisorientation:z.boolean(),
 painScore:z.number().int().min(0).max(10).optional(),
 severeDistress:z.boolean(),
 predictedResources:z.number().int().min(0).max(20),
 ageMonths:z.number().int().min(0).max(1500),
 heartRate:z.number().int().min(10).max(300).optional(),
 respiratoryRate:z.number().int().min(2).max(120).optional(),
 spo2:z.number().int().min(30).max(100).optional(),
 occurredAt:z.string().datetime(),
});
export async function handleTriageAssessment(req:Request,triageId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,triageId);const b=await parseJson(req,AssessBody);
  const esi=esiLevel({requiresLifeSavingIntervention:b.requiresLifeSavingIntervention,highRiskSituation:b.highRiskSituation,
   newConfusionLethargyDisorientation:b.newConfusionLethargyDisorientation,
   ...(b.painScore===undefined?{}:{painScore:b.painScore}),
   severeDistress:b.severeDistress,predictedResources:b.predictedResources,ageMonths:b.ageMonths,
   vitals:{...(b.heartRate===undefined?{}:{heartRate:b.heartRate}),...(b.respiratoryRate===undefined?{}:{respiratoryRate:b.respiratoryRate}),
    ...(b.spo2===undefined?{}:{spo2:b.spo2})}});
  // El plazo de reevaluación se calcula y se guarda con su FUENTE: ESI no publica tiempos, los de CTAS sí, y mezclarlos sin
  // decirlo sería atribuir a una escala un número que no es suyo.
  const reassessDueAt=reassessmentDueAt(esi.level,b.occurredAt);
  return await commit(ctx,idempotencyKey,expectedVersion,triageId,folded,"TRIAGED","TRIAGE_TRIAGED",
   {kind:"TRIAGED",acuity:esi.level,decisionPoint:esi.decisionPoint,rationale:esi.rationale,
    dangerZoneVitals:esi.dangerZoneVitals,vitalsMissing:esi.vitalsMissing,upgradeConsidered:esi.upgradeConsidered,
    algorithm:ESI_ALGORITHM,reassessDueAt,reassessSource:REASSESSMENT_SOURCE,
    discriminators:{requiresLifeSavingIntervention:b.requiresLifeSavingIntervention,highRiskSituation:b.highRiskSituation,
     newConfusionLethargyDisorientation:b.newConfusionLethargyDisorientation,painScore:b.painScore??null,
     severeDistress:b.severeDistress,predictedResources:b.predictedResources,ageMonths:b.ageMonths,
     heartRate:b.heartRate??null,respiratoryRate:b.respiratoryRate??null,spo2:b.spo2??null}},
   b.occurredAt,"triage.triaged",
   // El nivel calculado viaja en la RESPUESTA, no solo en el evento: la pantalla tiene que mostrar lo que el algoritmo
   // decidió, no lo que ella creía antes de pedirlo. Con el nivel van el punto de decisión, el plazo con su fuente y la
   // sugerencia de subir de nivel del punto D.
   {acuity:esi.level,decisionPoint:esi.decisionPoint,rationale:esi.rationale,dangerZoneVitals:esi.dangerZoneVitals,
    vitalsMissing:esi.vitalsMissing,upgradeConsidered:esi.upgradeConsidered,algorithm:ESI_ALGORITHM,
    reassessDueAt,reassessSource:REASSESSMENT_SOURCE});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleTriageClosure(req:Request,triageId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,triageId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,triageId,folded,"CLOSED","TRIAGE_CLOSED",{kind:"CLOSED"},b.occurredAt,"triage.closed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTriageLwbs(req:Request,triageId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,triageId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,triageId,folded,"LWBS","TRIAGE_LWBS",{kind:"LWBS",reason:b.reason},b.occurredAt,"triage.lwbs");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
