import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldClaim,assertClaimTransition,type FoldedClaim,type ClaimState}from"../../../packages/claim-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{lookupIcd10,normalizeIcd10}from"../../../packages/terminology/src";
import{aggregateLifecycle}from"./lifecycle-factory";
// EPIC AR (profundidad): los códigos de la reclamación se validan contra CIE-10 y se codifican con descripción canónica.
// EPIC Y — Ciclo de vida de una reclamación de facturación: DRAFT -> CODED -> SUBMITTED -> {PAID, REJECTED};
// REJECTED -> SUBMITTED (reenvío); anulable desde no-terminal. Seguimiento de estado, NO mueve dinero.
// Ciclo de ingresos: codificar/enviar/conciliar exige scope billing:write.
const AGG="Claim";
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"billing:write",purpose:"TREATMENT"});
}

// Auditoría 2026-09-19, anexo R02b (R2B-021, lote 18) — EL MONTO DE UNA FACTURA NO ES TEXTO LIBRE, Y EL SIGNO IMPORTA.
//
// Dos defectos encadenados. (1) `amount` era `z.string().min(1)`: «asdf» se aceptaba al emitir y más tarde se convertía en 0
// en silencio, así que una factura entraba al registro con importe cero sin que nadie lo supiera. (2) El parseo del tablero
// hacía `replace(/[^0-9.]/g,"")`, que elimina el signo MENOS: una nota de crédito o un ajuste de «-500.00» se leía como 500
// positivos e INFLABA los ingresos. Las dos cosas se arreglan en el mismo sitio, que es la puerta.
//
// El importe se guarda como texto normalizado (no como número de punto flotante) a propósito: el dinero se compara y se suma
// en la base con `numeric`, y un `float` de JavaScript introduce errores de redondeo que en una factura no son aceptables.
const MONTO=/^-?\d{1,12}(\.\d{1,2})?$/;
/**
 * Parsea un importe monetario CONSERVANDO EL SIGNO. Única autoridad: la ruta del tablero la importa en vez de tener su
 * propio parseo, que es exactamente cómo apareció el defecto del signo.
 */
export function parseMoney(raw:string):number{
 const t=String(raw).trim().replace(/\s|,/g,"");
 if(!MONTO.test(t))return 0; // eventos anteriores al lote 18 pueden traer texto libre: se leen como 0, no como NaN
 const n=Number(t);
 return Number.isFinite(n)?n:0;
}
export const DraftBody=z.object({claimId:z.string().uuid(),patientId:z.string().uuid(),
 amount:z.string().trim().min(1).refine(v=>MONTO.test(v.replace(/\s|,/g,"")),
  "El importe debe ser un número con hasta dos decimales; se admite negativo para notas de crédito y ajustes"),
 currency:z.enum(["MXN","USD"]),occurredAt:z.string().datetime()});
export async function handleClaimDraft(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,DraftBody);
  await requireRegisteredPatient(ctx,b.patientId); // L-07: el paciente debe existir en el tenant
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.claimId,expectedVersion:0,eventType:"CLAIM_DRAFTED",payload:{kind:"DRAFTED",patientId:b.patientId,amount:b.amount,currency:b.currency},occurredAt:b.occurredAt,topic:"claim.drafted"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({claimId:b.claimId,state:"DRAFT",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedClaim,ClaimState>({aggregateType:AGG,idKey:"claimId",notFound:"Claim not found",fold:foldClaim,assertTransition:assertClaimTransition,authz});
const loadForTransition=(req:Request,claimId:string)=>LIFECYCLE.loadForTransition(req,claimId);
const commit=(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,claimId:string,folded:FoldedClaim,to:ClaimState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string)=>
 LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,claimId,folded,to,eventType,payload,occurredAt,topic);

export const CodeBody=z.object({codes:z.array(z.string().min(1)).min(1),occurredAt:z.string().datetime()});
export async function handleClaimCoding(req:Request,claimId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,claimId);const b=await parseJson(req,CodeBody);
  // Profundidad clínica: cada código debe existir en CIE-10; se codifica con su descripción canónica.
  const coded=b.codes.map(c=>{const e=lookupIcd10(c);if(!e)throw new ClinicalError("VALIDATION_ERROR","Código CIE-10 no válido o no reconocido",{code:c});return{code:normalizeIcd10(c),description:e.description};});
  return await commit(ctx,idempotencyKey,expectedVersion,claimId,folded,"CODED","CLAIM_CODED",{kind:"CODED",codes:coded.map(x=>x.code),codeSystem:"ICD-10",coded},b.occurredAt,"claim.coded");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const WhenBody=z.object({occurredAt:z.string().datetime()});
export async function handleClaimSubmission(req:Request,claimId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,claimId);const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,claimId,folded,"SUBMITTED","CLAIM_SUBMITTED",{kind:"SUBMITTED"},b.occurredAt,"claim.submitted");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const RefBody=z.object({reference:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleClaimPayment(req:Request,claimId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,claimId);const b=await parseJson(req,RefBody);
  return await commit(ctx,idempotencyKey,expectedVersion,claimId,folded,"PAID","CLAIM_PAID",{kind:"PAID",reference:b.reference},b.occurredAt,"claim.paid");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export const ReasonBody=z.object({reason:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleClaimRejection(req:Request,claimId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,claimId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,claimId,folded,"REJECTED","CLAIM_REJECTED",{kind:"REJECTED",reason:b.reason},b.occurredAt,"claim.rejected");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
export async function handleClaimVoid(req:Request,claimId:string):Promise<Response>{
 try{const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,claimId);const b=await parseJson(req,ReasonBody);
  return await commit(ctx,idempotencyKey,expectedVersion,claimId,folded,"VOIDED","CLAIM_VOIDED",{kind:"VOIDED",reason:b.reason},b.occurredAt,"claim.voided");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
