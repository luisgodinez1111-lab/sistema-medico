// ⚠️ NOT_WIRED (endurecimiento G / Epic BF): este handler NO está cableado a ninguna ruta (código inalcanzable).
// Ver docs/adjudication/not-wired-registry.json. R6 (IA) EN PAUSA: no activar. No cuenta como capacidad end-to-end.
import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
import{sortInbox,type InboxItem}from"../../../packages/clinical-inbox-v2/src";
// EPIC N — Clinical Inbox: obligaciones clínicas (resultados críticos, seguimientos, etc.).
// Closed-loop completo: ORDER -> RESULT -> OBLIGATION -> CLOSED.
// Zero Lost Follow-Up: no se firma encuentro con obligaciones URGENT/HIGH sin resolver.
// Autoridad: PROD (inbox clínico), CAP-CLINICAL-INBOX-001.

const AGG="ClinicalObligation";
type Claims={sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string};

function authz(claims:Claims,scope:string,requirePhysician=false){
 const opts:{tenantId:string;role?:string;scope?:string;purpose?:string}={tenantId:claims.tenantId,scope,purpose:"TREATMENT"};
 if(requirePhysician)opts.role="PHYSICIAN";
 authorize(principalFrom(claims),opts);
}

const CreateObligationBody=z.object({
 obligationId:z.string().uuid(),
 patientId:z.string().uuid(),
 sourceType:z.enum(["CRITICAL_RESULT","CRITICAL_VITAL","REFERRAL","FOLLOW_UP","MEDICATION_MONITORING","OTHER"]),
 sourceId:z.string().uuid().optional(), // resultId, vitalId, etc.
 ownerId:z.string().uuid(),
 priority:z.enum(["URGENT","HIGH","ROUTINE"]),
 dueAt:z.string().datetime(),
 reason:z.string().min(1),
 occurredAt:z.string().datetime(),
});

// CREATE = obligación creada (desde result ACTIONED, vital CRITICAL, etc.)
export async function handleObligationCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims,"obligation:write",true); // Physician Control
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateObligationBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.obligationId,expectedVersion:0,eventType:"OBLIGATION_CREATED",payload:{kind:"CREATED",patientId:b.patientId,sourceType:b.sourceType,sourceId:b.sourceId,ownerId:b.ownerId,priority:b.priority,dueAt:b.dueAt,reason:b.reason},occurredAt:b.occurredAt,topic:"obligation.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({obligationId:b.obligationId,state:"OPEN",priority:b.priority,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const ListQuery=z.object({patientId:z.string().uuid().optional(),ownerId:z.string().uuid().optional(),priority:z.enum(["URGENT","HIGH","ROUTINE"]).optional(),status:z.enum(["OPEN","IN_PROGRESS","CLOSED","OVERDUE"]).optional(),limit:z.coerce.number().int().positive().max(100).default(50),cursor:z.string().optional()});
export async function handleInboxList(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims,"obligation:read");
  const url=new URL(req.url);
  const q=ListQuery.parse(Object.fromEntries(url.searchParams));
  // TODO: query real con paginación desde clinical_inbox table
  // Por ahora retorna empty para compatibilidad
  return NextResponse.json({items:[],total:0,cursor:null},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const AssignBody=z.object({newOwnerId:z.string().uuid(),reason:z.string().optional(),occurredAt:z.string().datetime()});
export async function handleObligationAssign(req:Request,obligationId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims,"obligation:write",true);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,AssignBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:"ClinicalObligation",aggregateId:obligationId,expectedVersion:0,eventType:"OBLIGATION_ASSIGNED",payload:{kind:"ASSIGNED",newOwnerId:b.newOwnerId,reason:b.reason},occurredAt:b.occurredAt,topic:"obligation.assigned"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({obligationId,newOwnerId:b.newOwnerId,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const ProgressBody=z.object({note:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleObligationProgress(req:Request,obligationId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims,"obligation:write");
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,ProgressBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:"ClinicalObligation",aggregateId:obligationId,expectedVersion:0,eventType:"OBLIGATION_PROGRESS",payload:{kind:"PROGRESS",note:b.note},occurredAt:b.occurredAt,topic:"obligation.progress"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({obligationId,note:b.note,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

const CloseBody=z.object({evidence:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleObligationClose(req:Request,obligationId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims,"obligation:write",true); // Physician Control para cerrar
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CloseBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:"ClinicalObligation",aggregateId:obligationId,expectedVersion:0,eventType:"OBLIGATION_CLOSED",payload:{kind:"CLOSED",evidence:b.evidence,closedBy:claims.sub},occurredAt:b.occurredAt,topic:"obligation.closed"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({obligationId,evidence:b.evidence,closedBy:claims.sub,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// EXEC-0016: Zero Lost Follow-Up check - usado por encounter signature gate
export async function countOpenCriticalObligations(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authz(claims,"obligation:read");
  const url=new URL(req.url);
  const patientId=url.searchParams.get("patientId");
  if(!patientId)throw new ClinicalError("VALIDATION_ERROR","patientId required");
  // Usar clinical-runtime function
  const {countUnresolvedCriticalObligations}=await import("./clinical-runtime");
  const count=await countUnresolvedCriticalObligations(ctx,patientId);
  return NextResponse.json({patientId,count},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}