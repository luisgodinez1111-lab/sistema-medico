// Read-models del EXPEDIENTE: eventos por agregado, línea de tiempo, documento con su contenido, encuentro y
// obligaciones que bloquean la firma. Aquí viven las lecturas que dejan constancia de acceso a PHI (R01-026).
// Auditoría R01-001: extraído del god-module `clinical-runtime.ts`.
import postgres,{type Sql,type TransactionSql}from"postgres";
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{signatureBlockReason,type SignatureBlockReason}from"../../../../packages/obligation-fold/src";
import{logPhiAccess,patientAccessLog,type PhiAccessEntry,type PhiAccessAction,type PhiResourceType}from"../phi-access-log";
import{withTenantTx}from"./connection";
import{PAGE_LIMIT_MAX,Page,decodeCursor,encodeCursor}from"./pagination";
import{OBLIGATION_STATUS}from"./patient-facts";

// EPIC D — Replay idempotente previo a la validación de state-machine: si este Idempotency-Key
// ya produjo ESTE comando exacto (mismo hash) y quedó COMPLETED, devuelve la respuesta guardada.
// Así un reintento de una transición ya aplicada no choca con la SM (el estado ya avanzó).
// Auditoría L-04/K-05 — Eventos de ANOTACIÓN por tipo de agregado: enriquecen el agregado sin cambiar su estado. Toda
// consulta genérica que derive el estado del "último evento" debe ignorarlos; si no, corregir el teléfono de un paciente
// fallecido lo mostraba ACTIVO, y modificar una dosis habría sacado la medicación de la lista de activas.
// Alias fijo `c` (el de las subconsultas latest_kind). AMENDED es anotación SOLO en Patient (en VitalSign/Document es estado).
export const lifecycleEventOnly=(tx:postgres.TransactionSql)=>tx`not (
  (c.aggregate_type='Medication' and c.payload->>'kind' in ('MODIFIED','RECONCILED'))
  or (c.aggregate_type='ClinicalProblem' and c.payload->>'kind' in ('EPISTEMIC_CHANGED','EVIDENCE_UPDATED'))
  or (c.aggregate_type='Patient' and c.payload->>'kind'='AMENDED'))`;
// EPIC N — Timeline del paciente: un item por agregado clínico del paciente, con tipo, último kind
// (estado), versión y fechas. RLS-scoped. SIN PHI: solo metadatos, nunca el contenido clínico.
export type TimelineItem=Readonly<{aggregateType:string;aggregateId:string;latestKind:string;status:string;version:number;openedAt:string;lastAt:string}>;
export async function readPatientTimeline(ctx:HttpTenantContext,patientId:string,page:{limit:number;cursor?:string|null}={limit:PAGE_LIMIT_MAX}):Promise<Page<TimelineItem>>{
 const after=decodeCursor(page.cursor,2);const afterAt=after?String(after[0]):null,afterId=after?String(after[1]):null;
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and ${lifecycleEventOnly(tx)} order by sequence desc limit 1) as latest_kind,
     (select payload->>'status' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and ${lifecycleEventOnly(tx)} order by sequence desc limit 1) as latest_status,
     max(r.sequence) as version, min(r.occurred_at) as opened_at, max(r.occurred_at) as last_at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_id in (
     select aggregate_id from clinical_events where tenant_id=${ctx.tenantId} and sequence=1 and payload->>'patientId'=${patientId})
   group by r.aggregate_id, r.aggregate_type
   having (${afterAt}::timestamptz is null or (min(r.occurred_at), r.aggregate_id::text) < (${afterAt}::timestamptz, ${afterId}::text))
   order by min(r.occurred_at) desc, r.aggregate_id desc
   limit ${page.limit+1}`;
  const items=rows.slice(0,page.limit).map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),latestKind:String(x.latest_kind??""),status:String(x.latest_status??""),version:Number(x.version),openedAt:new Date(String(x.opened_at)).toISOString(),lastAt:new Date(String(x.last_at)).toISOString()}));
  const last=items[items.length-1];
  // R01-026: constancia de acceso de lectura a PHI (misma transacción que la consulta).
  await logPhiAccess(tx,ctx,{resourceType:"PATIENT_TIMELINE",resourceId:patientId,patientId});
  return{items,nextCursor:rows.length>page.limit&&last?encodeCursor([last.openedAt,last.aggregateId]):null};
 });
}
// EPIC AC — Worklist poblacional: un renglón por agregado clínico del tenant (todos los pacientes),
// con su patientId y su último kind (estado). RLS-scoped al tenant. SIN PHI: solo tipo/estado/ids.
export type PanelRowData=Readonly<{aggregateType:string;aggregateId:string;patientId:string;latestKind:string;status:string}>;
export async function readTenantOpenAggregates(ctx:HttpTenantContext):Promise<ReadonlyArray<PanelRowData>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type, r.payload->>'patientId' as patient_id,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and ${lifecycleEventOnly(tx)} order by sequence desc limit 1) as latest_kind,
     (select payload->>'status' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) as latest_status
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.sequence=1 and r.payload->>'patientId' is not null
     -- Coherencia de lectores: un resultado ANULADO (ENTERED_IN_ERROR) o CORREGIDO (supersedido) no es un pendiente vivo
     -- del worklist. Sin esto generaba un gap como si siguiera abierto. Solo aplica a DiagnosticResult; el resto no cambia.
     and not (r.aggregate_type='DiagnosticResult' and (
       exists(select 1 from clinical_events e where e.tenant_id=${ctx.tenantId} and e.aggregate_id=r.aggregate_id and e.payload->>'kind'='ENTERED_IN_ERROR')
       or exists(select 1 from clinical_events s where s.tenant_id=${ctx.tenantId} and s.aggregate_type='DiagnosticResult' and s.payload->>'kind'='RECEIVED' and s.payload->>'supersedes'=r.aggregate_id::text)))`;
  return rows.map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),patientId:String(x.patient_id),latestKind:String(x.latest_kind??""),status:String(x.latest_status??"")}));
 });
}
// EPIC AB — Manifiesto del expediente: filas estructurales (agregado/secuencia/kind/fecha) de TODOS
// los agregados del paciente. RLS-scoped. SIN volcar payloads PHI: solo el kind (estado) y la fecha.
export type RecordRow=Readonly<{aggregateType:string;aggregateId:string;sequence:number;kind:string;occurredAt:string}>;
export async function readPatientRecordRows(ctx:HttpTenantContext,patientId:string):Promise<ReadonlyArray<RecordRow>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id, r.aggregate_type, r.sequence, r.payload->>'kind' as kind, r.occurred_at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_id in (
     select aggregate_id from clinical_events where tenant_id=${ctx.tenantId} and sequence=1 and payload->>'patientId'=${patientId})
   order by r.aggregate_id, r.sequence`;
  // R01-026: constancia de acceso de lectura a PHI (misma transacción que la consulta).
  await logPhiAccess(tx,ctx,{resourceType:"PATIENT_RECORD",resourceId:patientId,patientId});
  return rows.map(x=>({aggregateType:String(x.aggregate_type),aggregateId:String(x.aggregate_id),sequence:Number(x.sequence),kind:String(x.kind??""),occurredAt:String(x.occurred_at)}));
 });
}
// EPIC D — Lectura RLS-scoped del stream de eventos CON payload (para reconstruir estado).
// El payload es contenido clínico (fuente de verdad, RLS-aislado); nunca se loguea.
export async function readEncounterEvents(ctx:HttpTenantContext,encounterId:string):Promise<ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`select sequence,payload from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId} order by sequence`;
  return rows.map(r=>({sequence:Number(r.sequence),payload:(r.payload??{}) as Record<string,unknown>}));
 });
}
// EPIC G — Lector genérico de eventos de un agregado (RLS-scoped, con payload).
// Payload de UN evento por su id, acotado al agregado esperado (RLS-scoped). El id del evento es determinista respecto de
// la llave de idempotencia (derivedUuid(key,"event")), así que esto responde: "¿esta llave ya produjo su evento, y con qué?".
export async function readEventPayloadById(ctx:HttpTenantContext,eventId:string,aggregateId:string):Promise<Record<string,unknown>|undefined>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`select payload from clinical_events where tenant_id=${ctx.tenantId} and id=${eventId} and aggregate_id=${aggregateId} limit 1`;
  const p=rows[0]?.payload;return p&&typeof p==="object"?p as Record<string,unknown>:undefined;
 });
}
export async function readAggregateEvents(ctx:HttpTenantContext,aggregateId:string):Promise<ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>>{
 return readEncounterEvents(ctx,aggregateId);
}
// EPIC Z/UI — Repositorio de documentos: UN documento clínico con su CONTENIDO real, adenda (append-only) y
// firma, plegando todos sus eventos (CREATED/FINALIZED/SIGNED/AMENDED) en orden. RLS-scoped. Nunca borra: cada
// enmienda suma. version = nº de eventos del agregado.
export type DocAddendum=Readonly<{addendum:string;authorId:string;at:string}>;
export type DocSignature=Readonly<{authorId:string;contentHash:string;signatureDigest:string;signedAt:string}>;
// Un archivo binario adjunto (PHI) guardado en Vercel Blob privado. En el event stream SOLO va la referencia
// (pathname del blob + hash + metadatos), nunca el binario. attachmentId = id determinista del evento adjunto.
export type DocAttachment=Readonly<{attachmentId:string;filename:string;mime:string;size:number;pathname:string;contentHash:string;authorId:string;attachedAt:string}>;
export type DocumentDetail=Readonly<{exists:boolean;documentId:string;patientId:string;title:string;docType:string;content:string;state:"DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED";version:number;createdAt:string;addenda:DocAddendum[];signature:DocSignature|null;attachments:DocAttachment[]}>;
export async function documentDetail(ctx:HttpTenantContext,documentId:string):Promise<DocumentDetail>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.payload as payload, a.occurred_at as occurred_at
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalDocument' and a.aggregate_id=${documentId}
   order by a.sequence asc`;
  if(rows.length===0)return{exists:false,documentId,patientId:"",title:"",docType:"",content:"",state:"DRAFT",version:0,createdAt:"",addenda:[],signature:null,attachments:[]};
  let patientId="",title="",docType="",content="",createdAt="",state:DocumentDetail["state"]="DRAFT",signature:DocSignature|null=null;const addenda:DocAddendum[]=[];const attachments:DocAttachment[]=[];
  for(const r of rows){const o=r as Record<string,unknown>;const p=(o.payload??{}) as Record<string,unknown>;const at=o.occurred_at?new Date(String(o.occurred_at)).toISOString():"";
   switch(String(p.kind)){
    case"CREATED":patientId=String(p.patientId??"");docType=String(p.docType??"OTHER");title=String(p.title??"");content=String(p.content??"");createdAt=at;state="DRAFT";break;
    case"FINALIZED":state="FINALIZED";break;
    case"SIGNED":state="SIGNED";signature={authorId:String(p.authorId??""),contentHash:String(p.contentHash??""),signatureDigest:String(p.signatureDigest??""),signedAt:String(p.signedAt??at)};break;
    case"AMENDED":state="AMENDED";addenda.push({addendum:String(p.addendum??""),authorId:String(p.authorId??""),at:String(p.amendedAt??at)});break;
    case"ATTACHED":attachments.push({attachmentId:String(p.attachmentId??""),filename:String(p.filename??"archivo"),mime:String(p.mime??"application/octet-stream"),size:Number(p.size??0),pathname:String(p.pathname??""),contentHash:String(p.contentHash??""),authorId:String(p.authorId??""),attachedAt:String(p.attachedAt??at)});break;
    case"ATTACHMENT_REMOVED":{const rid=String(p.attachmentId??"");const idx=attachments.findIndex(a=>a.attachmentId===rid);if(idx>=0)attachments.splice(idx,1);break;}
   }
  }
  // R01-026: el detalle de un documento clínico ES el contenido; su lectura queda registrada con el paciente al que pertenece.
  await logPhiAccess(tx,ctx,{resourceType:"CLINICAL_DOCUMENT",resourceId:documentId,patientId:patientId||undefined});
  return{exists:true,documentId,patientId,title,docType,content,state,version:rows.length,createdAt,addenda,signature,attachments};
 });
}
// EPIC D — Gate Zero Lost Follow-Up: obligaciones críticas (URGENT) del paciente sin resolver.
// Auditoría 2026-09-19 (L-01) — GATE REAL de obligaciones. Antes contaba filas de `clinical_inbox`, tabla en la que ningún
// código inserta (el rol de la app solo tiene SELECT): devolvía SIEMPRE 0 y el médico podía firmar con cualquier seguimiento
// crítico abierto. Ahora se deriva de la ÚNICA fuente de verdad, el stream de eventos de ClinicalObligation, y el criterio es
// la función pura `signatureBlockReason` (URGENTE o VENCIDA, sin resolver). La hora de referencia es la del SERVIDOR.
export type BlockingObligation=Readonly<{obligationId:string;reason:SignatureBlockReason;priority:string;dueAt:string}>;
export async function blockingObligations(ctx:HttpTenantContext,patientId:string,asOfIso:string=new Date().toISOString()):Promise<BlockingObligation[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'dueAt' as due_at, a.payload->>'priority' as priority,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalObligation' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}`;
  const out:BlockingObligation[]=[];
  for(const r of rows){const o=r as Record<string,unknown>;
   const state=OBLIGATION_STATUS[String(o.last_kind??"CREATED")]??"OPEN"; // kind desconocido => OPEN (fail-closed: sigue contando)
   const dueAt=o.due_at==null?"":String(o.due_at);const priority=o.priority==null?"ROUTINE":String(o.priority);
   const reason=signatureBlockReason({state,priority,dueAt},asOfIso);
   if(reason)out.push({obligationId:String(o.aggregate_id),reason,priority,dueAt});}
  return out;
 });
}
export async function countUnresolvedCriticalObligations(ctx:HttpTenantContext,patientId:string):Promise<number>{
 return(await blockingObligations(ctx,patientId)).length;
}
// EPIC G — Cierre del loop Zero Lost Follow-Up: resultados diagnósticos CRÍTICOS del paciente que no se han CERRADO.
// Auditoría 2026-09-19 (L-01/C-20): antes solo contaban los que ya estaban en ACTIONED, de modo que el caso MÁS peligroso
// —un crítico recién RECIBIDO o solo VERIFICADO, que nadie ha atendido— no bloqueaba la firma, aunque la propia UI promete
// "bloquea la firma hasta cerrarse". Ahora cuenta todo crítico (por valor o por Δ) sin evento CLOSED.
export async function countOpenCriticalResults(ctx:HttpTenantContext,patientId:string):Promise<number>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select count(distinct r.aggregate_id)::int n
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult'
     and r.payload->>'kind'='RECEIVED' and r.payload->>'patientId'=${patientId} and r.payload->>'critical'='true'
     and not exists(
      select 1 from clinical_events c
      where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and c.payload->>'kind' in ('CLOSED','CORRECTED','ENTERED_IN_ERROR'))`; // C-02: un crítico corregido deja de bloquear · R03-10: un crítico ANULADO tampoco // C-02: un crítico corregido deja de bloquear; si la corrección sigue siendo crítica, bloquea el nuevo
  return Number(rows[0]?.n??0);
 });
}
// EPIC AN + Zero Lost Follow-Up: cuenta signos vitales CRÍTICOS del paciente sin seguimiento adecuado. Bloquea la firma.
//
// Auditoría multi-agente (gate de firma). Esta función tenía DOS defectos simétricos:
//  · SUB-bloqueo (fuga de seguridad): se "limpiaba" en cuanto existía CUALQUIER obligación con ese sourceVitalId —aunque
//    fuera ROUTINE, o estuviera CANCELADA—. Como `blockingObligations` solo bloquea URGENT/vencidas, un vital crítico con
//    una obligación ROUTINE (o cancelada) no lo bloqueaba NINGÚN gate: se podía firmar con una crisis hipertensiva sin atender.
//  · SOBRE-bloqueo: contaba por CUALQUIER evento RECORDED/AMENDED con critical='true', sin mirar el VIGENTE; un crítico
//    enmendado a normal, o ANULADO (ENTERED_IN_ERROR), seguía bloqueando para siempre (incoherente con countOpenCriticalResults).
//
// Criterio corregido (mejoras INEQUÍVOCAS, simétricas a countOpenCriticalResults; no cambian la política de "una obligación
// de seguimiento abierta releva al vital", que es diseño Zero-Lost-Follow-Up): un vital crítico bloquea MIENTRAS su lectura
// VIGENTE (última RECORDED/AMENDED) siga siendo crítica, NO esté anulado (ENTERED_IN_ERROR), y NO tenga una obligación de
// seguimiento ligada (sourceVitalId) cuyo estado actual NO sea CANCELADO. Antes bastaba que EXISTIERA un evento CREATED de
// obligación —aunque luego se CANCELARA— para dejar de contar: crear y cancelar vaciaba el gate. Y se contaba por cualquier
// evento crítico sin mirar el vigente, así que un crítico enmendado a normal o anulado bloqueaba para siempre.
// DECISIÓN DEL DUEÑO (resuelta): a un vital CRÍTICO solo lo releva una obligación de seguimiento URGENTE. Antes bastaba
// CUALQUIER obligación abierta no-cancelada —y la prioridad por defecto al crear una obligación es ROUTINE—, así que un vital
// crítico (p. ej. crisis hipertensiva) quedaba relevado de ESTE gate por un simple recordatorio de rutina, y como
// `blockingObligations` solo bloquea URGENT/vencidas, una ROUTINE no vencida tampoco lo frenaba: se podía firmar con la crisis
// sin atender. Ahora el relevo exige prioridad URGENT en el evento CREATED de la obligación ligada (sourceVitalId) y que su
// estado vigente no sea CANCELLED. Consecuencia buscada: mientras esa URGENT siga abierta, `blockingObligations` también la
// cuenta (URGENT), así que el vital crítico sigue bloqueando la firma hasta que el seguimiento urgente se complete o cancele.
export async function countOpenCriticalVitals(ctx:HttpTenantContext,patientId:string):Promise<number>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select count(distinct r.aggregate_id)::int n
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='VitalSign'
     and r.payload->>'kind'='RECORDED' and r.payload->>'patientId'=${patientId}
     and (select v.payload->>'critical' from clinical_events v where v.tenant_id=${ctx.tenantId} and v.aggregate_id=r.aggregate_id and v.payload->>'kind' in ('RECORDED','AMENDED') order by v.sequence desc limit 1)='true'
     and not exists(select 1 from clinical_events e where e.tenant_id=${ctx.tenantId} and e.aggregate_id=r.aggregate_id and e.payload->>'kind'='ENTERED_IN_ERROR')
     and not exists(
      select 1 from clinical_events o
      where o.tenant_id=${ctx.tenantId} and o.aggregate_type='ClinicalObligation' and o.payload->>'kind'='CREATED'
        and o.payload->>'sourceVitalId'=r.aggregate_id::text and o.payload->>'priority'='URGENT'
        and coalesce((select ol.payload->>'kind' from clinical_events ol where ol.tenant_id=${ctx.tenantId} and ol.aggregate_id=o.aggregate_id order by ol.sequence desc limit 1),'CREATED')<>'CANCELLED')`;
  return Number(rows[0]?.n??0);
 });
}
export type EncounterView=Readonly<{encounterId:string;version:number;events:ReadonlyArray<{sequence:number;type:string;occurredAt:string}>}>;
// Lectura RLS-scoped del agregado (sin payload clínico: solo metadatos no-PHI).
export async function readEncounter(ctx:HttpTenantContext,encounterId:string):Promise<EncounterView|null>{
 return withTenantTx(ctx,async tx=>{
  const agg=await tx`select version from aggregate_versions where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId}`;
  const head=agg[0];
  if(!head)return null;
  const events=await tx`select sequence,aggregate_type,occurred_at from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${encounterId} order by sequence`;
  return{
   encounterId,
   version:Number(head.version),
   events:events.map(e=>({sequence:Number(e.sequence),type:String(e.aggregate_type),occurredAt:String(e.occurred_at)})),
  };
 });
}
