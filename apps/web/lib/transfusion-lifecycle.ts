import{NextResponse}from"next/server";
import{z}from"zod";
import{verifyBedside,type BloodProduct}from"../../../packages/transfusion-safety/src";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldTransfusion,assertTransfusionTransition,type FoldedTransfusion,type TransfusionState}from"../../../packages/transfusion-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC AJ — Ciclo de vida de una transfusión: ORDERED -> CROSSMATCHED -> TRANSFUSING -> {COMPLETED, REACTION}.
// Medicina transfusional; ordenar/cruzar/iniciar/completar/reacción/cancelar exige scope transfusion:write.
const AGG="Transfusion";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"transfusion:write",purpose:"TREATMENT"});
}

export const OrderBody=z.object({transfusionId:z.string().uuid(),patientId:z.string().uuid(),bloodProduct:z.enum(["PRBC","PLATELETS","FFP","CRYO","WHOLE_BLOOD"]),units:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTransfusionOrder(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,OrderBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.transfusionId,expectedVersion:0,eventType:"TRANSFUSION_ORDERED",payload:{kind:"ORDERED",patientId:b.patientId,bloodProduct:b.bloodProduct,units:b.units},occurredAt:b.occurredAt,topic:"transfusion.ordered"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({transfusionId:b.transfusionId,state:"ORDERED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedTransfusion,TransfusionState>({aggregateType:AGG,idKey:"transfusionId",notFound:"Transfusion not found",fold:foldTransfusion,assertTransition:assertTransfusionTransition,authz});
const loadForTransition=(req:Request,transfusionId:string)=>LIFECYCLE.loadForTransition(req,transfusionId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,transfusionId:string,folded:FoldedTransfusion,to:TransfusionState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,transfusionId,folded,to,eventType,payload,occurredAt,topic);

export const WhenBody=z.object({occurredAt:z.string().datetime()});
// Auditoría 2026-09-19, anexo R02b (R2B-017) — LA BARRERA TRANSFUSIONAL, con datos, no con una fecha.
//
// «Pruebas cruzadas» e «iniciar transfusión» solo registraban `occurredAt`: ni el grupo del receptor, ni el de la unidad, ni
// quién verificó. La reacción hemolítica aguda por incompatibilidad ABO es el error transfusional catastrófico clásico y la
// barrera que lo evita es siempre la misma: comprobar el grupo de la unidad contra el del receptor, al pie de cama, por DOS
// personas distintas, antes de conectar. Ahora:
//   · CROSSMATCH exige los dos grupos (receptor y unidad), el número de la unidad y los dos verificadores identificados y
//     DISTINTOS. Si la combinación es incompatible, responde 422 con la razón clínica y NO registra la transición.
//   · START exige que la transición anterior haya quedado registrada con su verificación (la máquina de estados lo impone:
//     de ORDERED no se puede pasar a TRANSFUSING) y anota qué verificación la respalda.
const GRUPO=z.object({abo:z.enum(["O","A","B","AB"]),rh:z.enum(["POSITIVE","NEGATIVE"])});
export const CrossmatchBody=z.object({
 recipient:GRUPO,unit:GRUPO,
 unitId:z.string().trim().min(3,"El número de la unidad es obligatorio: sin él no hay trazabilidad de qué se transfundió").max(64),
 verifiedBy:z.tuple([z.string().trim().min(3),z.string().trim().min(3)]),
 occurredAt:z.string().datetime(),
});
export async function handleTransfusionCrossmatch(req:Request,transfusionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,transfusionId);const b=await parseJson(req,CrossmatchBody);
  const producto=(await readAggregateEvents(ctx,transfusionId)).find(e=>e.payload["kind"]==="ORDERED")?.payload["bloodProduct"];
  const check=verifyBedside({recipient:b.recipient,unit:b.unit,product:String(producto??"PRBC") as BloodProduct,unitId:b.unitId,verifiedBy:b.verifiedBy});
  if(!check.ok)throw new ClinicalError("VALIDATION_ERROR",`Verificación al pie de cama NO superada: ${check.blockers.join(" · ")}`,{blockers:check.blockers,compatibility:check.compatibility});
  return await commit(ctx,idempotencyKey,expectedVersion,transfusionId,folded,"CROSSMATCHED","TRANSFUSION_CROSSMATCHED",
   {kind:"CROSSMATCHED",recipientAbo:b.recipient.abo,recipientRh:b.recipient.rh,unitAbo:b.unit.abo,unitRh:b.unit.rh,unitId:b.unitId,
    verifiedBy:b.verifiedBy,compatibilityRule:check.compatibility.rule,compatibilityReason:check.compatibility.reason},
   b.occurredAt,"transfusion.crossmatched");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleTransfusionStart(req:Request,transfusionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,transfusionId);const b=await parseJson(req,WhenBody);
  // R2B-017: la verificación que respalda el inicio se cita en el evento. Sin evento de pruebas cruzadas no se llega aquí
  // (la máquina de estados lo impide), pero que el inicio DIGA con qué unidad y qué verificación arrancó es lo que permite
  // reconstruir después qué se transfundió a quién.
  const xm=(await readAggregateEvents(ctx,transfusionId)).find(e=>e.payload["kind"]==="CROSSMATCHED")?.payload;
  if(!xm?.["unitId"])throw new ClinicalError("CONFLICT","No se puede iniciar: la verificación al pie de cama no consta en el expediente",{reason:"BEDSIDE_CHECK_MISSING"});
  return await commit(ctx,idempotencyKey,expectedVersion,transfusionId,folded,"TRANSFUSING","TRANSFUSION_STARTED",
   {kind:"STARTED",unitId:xm["unitId"],verifiedBy:xm["verifiedBy"]},b.occurredAt,"transfusion.started");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleTransfusionCompletion(req:Request,transfusionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,transfusionId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,transfusionId,folded,"COMPLETED","TRANSFUSION_COMPLETED",{kind:"COMPLETED"},b.occurredAt,"transfusion.completed");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ReactionBody=z.object({reaction:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTransfusionReaction(req:Request,transfusionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,transfusionId);const b=await parseJson(req,ReactionBody);
  return await commit(ctx,idempotencyKey,expectedVersion,transfusionId,folded,"REACTION","TRANSFUSION_REACTION",{kind:"REACTION",reaction:b.reaction},b.occurredAt,"transfusion.reaction");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleTransfusionCancellation(req:Request,transfusionId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,transfusionId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,transfusionId,folded,"CANCELLED","TRANSFUSION_CANCELLED",{kind:"CANCELLED",reason:b.reason},b.occurredAt,"transfusion.cancelled");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
