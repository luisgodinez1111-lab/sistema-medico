import{NextResponse}from"next/server";
import crypto from"node:crypto";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{foldDocument,assertDocumentTransition,type FoldedDocument,type DocumentState}from"../../../packages/document-fold/src";
import{runClinicalCommand,lookupReplay,readAggregateEvents,documentDetail}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,requireMutationHeaders,resolveVerified,parseJson}from"./http-command";
// EPIC I — Ciclo de vida del documento clínico sobre el kernel. Autoridad PROD-014-R022 /
// PROD-022-R018: la firma produce un snapshot reproducible (contentHash) y las correcciones son
// addendum/amendment APPEND-ONLY; nunca se borra el historial. Physician Control: solo un médico
// humano firma y enmienda (la IA nunca firma el registro clínico-legal).
// EXEC-0009: Draft save y clinical/legal signature son operaciones DISTINTAS. Autosave NUNCA
// masquerade como signature. Encuentro: planned -> arrived -> in_progress -> ready_for_review -> signed -> amended -> closed.
const AGG="ClinicalDocument";
type Claims={sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string};

const CreateBody=z.object({documentId:z.string().uuid(),patientId:z.string().uuid(),encounterId:z.string().uuid().optional(),docType:z.enum(["PROGRESS_NOTE","DISCHARGE_SUMMARY","REFERRAL","PROCEDURE_NOTE","OTHER"]),title:z.string().min(1),content:z.string().min(1),occurredAt:z.string().datetime()});
// CREATE = borrador (draft). Cualquier clínico con scope document:write.
// NO es el registro firmado. Draft save != signature (EXEC-0009).
export async function handleDocumentCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"document:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.documentId,expectedVersion:0,eventType:"DOCUMENT_CREATED",payload:{kind:"CREATED",patientId:b.patientId,encounterId:b.encounterId,docType:b.docType,title:b.title,content:b.content},occurredAt:b.occurredAt,topic:"document.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({documentId:b.documentId,state:"DRAFT",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// AUTOSAVE (draft persist) - NO crea evento en event store, solo actualiza contenido local.
// EXEC-0009: Autosave must never masquerade as signature.
const AutosaveBody=z.object({documentId:z.string().uuid(),content:z.string().min(1),title:z.string().optional(),occurredAt:z.string().datetime()});
export async function handleDocumentAutosave(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"document:write",purpose:"TREATMENT"});
  const b=await parseJson(req,AutosaveBody);
  // Autosave NO va a event store. Solo actualiza proyección local/cliente.
  // El contenido definitivo se persiste en FINALIZE o SIGN.
  const contentHash=crypto.createHash("sha256").update(b.content).digest("hex");
  return NextResponse.json({documentId:b.documentId,contentHash,autosavedAt:b.occurredAt,note:"AUTOSAVE_ONLY_NO_EVENT"},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// GET (repositorio) — UN documento con su CONTENIDO real, adenda (append-only) y firma. Solo lectura, RLS-scoped.
const TYPE_UI:Record<string,string>={PROGRESS_NOTE:"Nota médica",DISCHARGE_SUMMARY:"Alta",REFERRAL:"Interconsulta",PROCEDURE_NOTE:"Procedimiento",OTHER:"Otro"};
const STATUS_ES:Record<string,string>={DRAFT:"Borrador",FINALIZED:"Finalizado",SIGNED:"Firmado",AMENDED:"Enmendado"};
export async function handleDocumentGet(req:Request,documentId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{tenantId:claims.tenantId,scope:"document:write",purpose:"TREATMENT"});
  const d=await documentDetail(ctx,documentId);
  if(!d.exists)throw new ClinicalError("NOT_FOUND","Document not found");
  return NextResponse.json({...d,typeLabel:TYPE_UI[d.docType]??"Otro",statusLabel:STATUS_ES[d.state]??"Borrador"},{status:200});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

async function loadForTransition(req:Request,documentId:string,requirePhysician:boolean){
 const{claims,ctx}=resolveVerified(req);
 const c=claims as Claims;
 authorize(principalFrom(c),requirePhysician?{tenantId:c.tenantId,role:"PHYSICIAN",scope:"document:write",purpose:"TREATMENT"}:{tenantId:c.tenantId,scope:"document:write",purpose:"TREATMENT"});
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const folded=foldDocument(await readAggregateEvents(ctx,documentId));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND","Document not found");
 return{claims:c,ctx,idempotencyKey,expectedVersion,folded};
}
async function commit(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,documentId:string,folded:FoldedDocument,to:DocumentState,eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string,extra:Record<string,unknown>={}){
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:documentId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){assertDocumentTransition(folded.state,to);result=await runClinicalCommand(ctx,cmd);}
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({documentId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed,...extra},{status:result.replayed?200:201});
}

const WhenBody=z.object({occurredAt:z.string().datetime()});
// FINALIZE = DRAFT -> FINALIZED (contenido listo para firmar, distinct from draft save).
export async function handleDocumentFinalization(req:Request,documentId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded}=await loadForTransition(req,documentId,false);
  const b=await parseJson(req,WhenBody);
  return await commit(ctx,idempotencyKey,expectedVersion,documentId,folded,"FINALIZED","DOCUMENT_FINALIZED",{kind:"FINALIZED"},b.occurredAt,"document.finalized");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// SIGN = FINALIZED -> SIGNED. Physician Control + snapshot reproducible (contentHash del contenido).
// EXEC-0009: Solo un médico humano firma. La IA nunca firma el registro clínico-legal.
export async function handleDocumentSignature(req:Request,documentId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded,claims}=await loadForTransition(req,documentId,true);
  const b=await parseJson(req,WhenBody);
  const contentHash=crypto.createHash("sha256").update(folded.content).digest("hex");
  const signatureDigest=crypto.createHash("sha256").update(`${documentId}:${expectedVersion}:${contentHash}:${claims.sub}:${b.occurredAt}`).digest("hex");
  return await commit(ctx,idempotencyKey,expectedVersion,documentId,folded,"SIGNED","DOCUMENT_SIGNED",{kind:"SIGNED",authorId:claims.sub,contentHash,signatureDigest,signedAt:b.occurredAt},b.occurredAt,"document.signed",{signatureDigest,contentHash});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
// AMEND = {SIGNED,AMENDED} -> AMENDED. Addendum APPEND-ONLY; nunca modifica el snapshot firmado.
// PROD-022-R018: NUNCA borrar historial de firma/amendments. Cada corrección suma.
const AmendBody=z.object({addendum:z.string().min(1),occurredAt:z.string().datetime()});
export async function handleDocumentAmendment(req:Request,documentId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,folded,claims}=await loadForTransition(req,documentId,true);
  const b=await parseJson(req,AmendBody);
  return await commit(ctx,idempotencyKey,expectedVersion,documentId,folded,"AMENDED","DOCUMENT_AMENDED",{kind:"AMENDED",authorId:claims.sub,addendum:b.addendum,amendedAt:b.occurredAt},b.occurredAt,"document.amended");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
