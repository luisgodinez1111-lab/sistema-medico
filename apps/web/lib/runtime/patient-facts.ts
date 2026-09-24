// Read-models de HECHOS CLÍNICOS de un paciente concreto: los que alimentan las barreras de seguridad, las
// calculadoras y el seguimiento. Auditoría R01-001: extraído del god-module `clinical-runtime.ts`.
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{normalizeLabValue}from"../../../../packages/lab-reference/src";
import{computeEGFR,type Sex}from"../../../../packages/renal-function/src";
import{signatureBlockReason,type SignatureBlockReason}from"../../../../packages/obligation-fold/src";
import{logPhiAccess,patientAccessLog,type PhiAccessEntry,type PhiAccessAction,type PhiResourceType}from"../phi-access-log";
import{withTenantTx}from"./connection";
import{patientDemographics}from"./patients";

// EPIC R — Gate de seguridad de medicación: sustancias con alergia ACTIVA del paciente (RLS-scoped).
// Una alergia está activa si su último evento es RECORDED o REACTIVATED (no REFUTED/INACTIVATED).
// Auditoría C-06: la barrera necesita GRAVEDAD y REACCIÓN, no solo la sustancia (una intolerancia leve no es una anafilaxia).
export type ActiveAllergy=Readonly<{substance:string;severity:"MILD"|"MODERATE"|"SEVERE"|null;reaction:string|null}>;
// La gravedad viaja como texto en el payload jsonb: se estrecha aquí (lo que no es una de las tres es «desconocida»,
// nunca «leve»). Antes esto lo tapaba un `as Promise<ActiveAllergy[]>` sobre el resultado de la transacción.
const asSeverity=(v:unknown):"MILD"|"MODERATE"|"SEVERE"|null=>{const s=String(v??"");return s==="MILD"||s==="MODERATE"||s==="SEVERE"?s:null;};
export async function activeAllergies(ctx:HttpTenantContext,patientId:string):Promise<ActiveAllergy[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'substance' as substance, r.payload->>'severity' as severity, r.payload->>'reaction' as reaction
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Allergy' and r.payload->>'kind'='RECORDED' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) in ('RECORDED','REACTIVATED')`;
  return rows.map(x=>({substance:String(x.substance??""),severity:asSeverity(x.severity),reaction:x.reaction==null?null:String(x.reaction)})).filter(a=>a.substance);
 });
}
export async function activeAllergySubstances(ctx:HttpTenantContext,patientId:string):Promise<string[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'substance' as substance
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Allergy' and r.payload->>'kind'='RECORDED' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) in ('RECORDED','REACTIVATED')`;
  return rows.map(x=>String(x.substance??"")).filter(Boolean);
 });
}
// EPIC AW — Medicaciones ACTIVAS del paciente (último kind ACTIVATED). RLS-scoped. Para el check de
// duplicación terapéutica en la prescripción. Devuelve drugCode.
// Auditoría L-04/K-05: el estado se deriva del último evento DE CICLO DE VIDA. Antes era "último evento = ACTIVATED": una
// medicación reanudada (RESUMED) dejaba de contar como activa, y cualquier anotación (MODIFIED/RECONCILED) la habría hecho
// desaparecer de las barreras de interacción y duplicidad. `excludeMedicationId`: al MODIFICAR una medicación activa no
// debe compararse consigo misma.
export async function activeMedicationDrugCodes(ctx:HttpTenantContext,patientId:string,excludeMedicationId?:string):Promise<string[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'drugCode' as drug_code
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Medication' and r.payload->>'kind'='PROPOSED' and r.payload->>'patientId'=${patientId}
     and r.aggregate_id::text<>${excludeMedicationId??""}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id
           and c.payload->>'kind' not in ('MODIFIED','RECONCILED') order by sequence desc limit 1) in ('ACTIVATED','RESUMED')`;
  return rows.map(x=>String(x.drug_code??"")).filter(Boolean);
 });
}
// EPIC BM — eGFR del paciente (CKD-EPI) desde demografía + última creatinina. undefined si no computable
// (sin datos, pediátrico, sexo no binario). Para el gate renal de la prescripción.
// Antigüedad máxima de la creatinina para decidir dosis (criterio de ingeniería, pendiente de validación clínica).
const EGFR_MAX_CREATININE_AGE_DAYS=365;
export async function patientEgfr(ctx:HttpTenantContext,patientId:string):Promise<number|undefined>{
 const demo=await patientDemographics(ctx,patientId);
 if(!demo?.birthDate)return undefined;
 const sex=demo.sexAtBirth;if(sex!=="FEMALE"&&sex!=="MALE")return undefined;
 const b=new Date(demo.birthDate),a=new Date();
 if(Number.isNaN(b.getTime()))return undefined;
 let age=a.getUTCFullYear()-b.getUTCFullYear();
 if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))age-=1;
 if(age<18)return undefined; // CKD-EPI adulto; en pediatría se usa Schwartz
 // Auditoría C-01/C-12: la barrera renal de prescripción NO debe decidir con una creatinina en otra unidad, implausible
 // u obsoleta. Si el dato no es utilizable, el eGFR es "desconocido" (=> la barrera queda NOT_EVALUATED, nunca "OK").
 const r=await latestAnalyteReading(ctx,patientId,"CREATININE");
 if(!r)return undefined;
 const n=normalizeLabValue("CREATININE",r.value);
 if(!n.ok)return undefined;
 if((Date.now()-new Date(r.occurredAt).getTime())/86_400_000>EGFR_MAX_CREATININE_AGE_DAYS)return undefined;
 return computeEGFR(n.canonicalValue,age,sex as Sex)?.egfr;
}
// EPIC BK — Códigos de vacunas ADMINISTRADAS del paciente (último kind ADMINISTERED). RLS-scoped.
// Auditoría C-10: las dosis periódicas (influenza anual, Td decenal) se deciden por la FECHA de la última aplicación.
export type AdministeredVaccine=Readonly<{code:string;occurredAt:string|null}>;
export async function administeredVaccines(ctx:HttpTenantContext,patientId:string):Promise<AdministeredVaccine[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'vaccineCode' as code,
     (select occurred_at from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id and c.payload->>'kind'='ADMINISTERED' order by sequence desc limit 1) as administered_at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Immunization' and r.payload->>'kind'='DUE' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1)='ADMINISTERED'`;
  return rows.map(x=>({code:String(x.code??""),occurredAt:x.administered_at?new Date(String(x.administered_at)).toISOString():null})).filter(v=>v.code);
 });
}
export async function administeredVaccineCodes(ctx:HttpTenantContext,patientId:string):Promise<string[]>{return(await administeredVaccines(ctx,patientId)).map(v=>v.code);}
// EPIC BC — Último valor registrado por tipo de signo vital del paciente (para computar NEWS2). RLS-scoped.
// Toma el evento RECORDED más reciente por vitalType. Devuelve un mapa {vitalType -> value textual}.
export async function latestVitalsByType(ctx:HttpTenantContext,patientId:string):Promise<Record<string,string>>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select distinct on (r.payload->>'vitalType') r.payload->>'vitalType' as vital_type, r.payload->>'value' as value
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='VitalSign' and r.payload->>'kind'='RECORDED'
     and r.payload->>'patientId'=${patientId}
   order by r.payload->>'vitalType', r.occurred_at desc, r.sequence desc`;
  const out:Record<string,string>={};for(const x of rows){const k=String(x.vital_type??"");if(k)out[k]=String(x.value??"");}
  return out;
 });
}
// EPIC BB — Valor PREVIO del mismo analito del paciente (resultado más reciente ya recibido). RLS-scoped.
// Para el delta check de laboratorio en la recepción de un resultado nuevo. Devuelve el value textual o undefined.
// `excludeResultId`: al RECIBIR un resultado, el "previo" jamás debe ser el propio resultado. Sin esto, el REINTENTO
// idempotente de un resultado con Δ crítico se comparaba contra sí mismo, producía otro payload y el kernel lo rechazaba
// por "misma llave, distinto contenido" en vez de devolver la respuesta original.
export async function latestResultValueForAnalyte(ctx:HttpTenantContext,patientId:string,analyte:string,excludeResultId?:string):Promise<string|undefined>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select coalesce(r.payload->>'canonicalValue',r.payload->>'value') as value
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult' and r.payload->>'kind'='RECEIVED'
     and r.payload->>'patientId'=${patientId} and upper(r.payload->>'analyte')=upper(${analyte})
     and r.aggregate_id::text<>${excludeResultId??""}
     and not exists(select 1 from clinical_events s where s.tenant_id=${ctx.tenantId} and s.aggregate_type='DiagnosticResult' and s.payload->>'kind'='RECEIVED' and s.payload->>'supersedes'=r.aggregate_id::text) -- C-02: corregido -> se lee el nuevo
   order by r.occurred_at desc, r.sequence desc limit 1`;
  const v=rows[0]?.value;if(v==null)return undefined;
  // Auditoría C-01: un valor físicamente IMPLAUSIBLE en la unidad canónica (evento antiguo capturado sin unidad en otra
  // escala) no se entrega como "el último valor" a ningún consumidor (paneles, contexto de referencia, delta-check).
  const n=normalizeLabValue(analyte,String(v));
  return !n.ok&&n.reason==="IMPLAUSIBLE"?undefined:String(v);
 });
}
// Auditoría 2026-09-19 (C-01/C-11/C-12) — Lectura COMPLETA del último resultado de un analito para CÁLCULOS:
// valor en unidad canónica + unidad declarada + si la unidad fue asumida + fecha + muestra + id del resultado.
// `latestResultValueForAnalyte` devuelve solo el número y por eso ninguna calculadora podía verificar nada.
export type AnalyteReading=Readonly<{analyte:string;rawValue:string;value:number;unit:string|null;canonicalUnit:string|null;unitAssumed:boolean;occurredAt:string;resultId:string;specimenId:string|null}>;
export async function latestAnalyteReading(ctx:HttpTenantContext,patientId:string,analyte:string):Promise<AnalyteReading|undefined>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.aggregate_id as result_id, r.occurred_at as at, r.payload->>'value' as raw, r.payload->>'canonicalValue' as canonical,
          r.payload->>'unit' as unit, r.payload->>'canonicalUnit' as canonical_unit, r.payload->>'unitAssumed' as unit_assumed, r.payload->>'specimenId' as specimen_id
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult' and r.payload->>'kind'='RECEIVED'
     and r.payload->>'patientId'=${patientId} and upper(r.payload->>'analyte')=upper(${analyte})
     and not exists(select 1 from clinical_events s where s.tenant_id=${ctx.tenantId} and s.aggregate_type='DiagnosticResult' and s.payload->>'kind'='RECEIVED' and s.payload->>'supersedes'=r.aggregate_id::text) -- C-02: corregido -> se lee el nuevo
   order by r.occurred_at desc, r.sequence desc limit 1`;
  const o=rows[0] as Record<string,unknown>|undefined;if(!o)return undefined;
  const raw=String(o["raw"]??"");const canonical=o["canonical"]==null?Number(raw.trim().replace(",",".")):Number(o["canonical"]);
  // Eventos anteriores a esta corrección no traen unidad: se declara `unitAssumed` (la plausibilidad se valida al usarlo).
  const legacy=o["canonical"]==null;
  return{analyte:analyte.toUpperCase(),rawValue:raw,value:canonical,unit:o["unit"]==null?null:String(o["unit"]),canonicalUnit:o["canonical_unit"]==null?null:String(o["canonical_unit"]),
   unitAssumed:legacy?true:String(o["unit_assumed"])==="true",occurredAt:new Date(String(o["at"])).toISOString(),resultId:String(o["result_id"]),specimenId:o["specimen_id"]==null?null:String(o["specimen_id"])};
 });
}
// EPIC CH — Serie temporal de un analito (evolución longitudinal, panel 4). Todos los resultados
// RECEIVED de ese analito, orden ascendente por fecha. RLS-scoped; valores numéricos.
export async function analyteSeries(ctx:HttpTenantContext,patientId:string,analyte:string):Promise<{value:number;at:string}[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select coalesce(r.payload->>'canonicalValue',r.payload->>'value') as value, r.occurred_at as at
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='DiagnosticResult' and r.payload->>'kind'='RECEIVED'
     and r.payload->>'patientId'=${patientId} and upper(r.payload->>'analyte')=upper(${analyte})
     and not exists(select 1 from clinical_events s where s.tenant_id=${ctx.tenantId} and s.aggregate_type='DiagnosticResult' and s.payload->>'kind'='RECEIVED' and s.payload->>'supersedes'=r.aggregate_id::text) -- C-02: corregido -> se lee el nuevo
   order by r.occurred_at asc, r.sequence asc`;
  // Los puntos implausibles se EXCLUYEN de la serie: un solo valor en otra escala deforma la tendencia y su pendiente.
  return rows.map(r=>{const o=r as Record<string,unknown>;return{value:Number(o.value),at:String(o.at)};}).filter(p=>Number.isFinite(p.value)&&normalizeLabValue(analyte,p.value).ok);
 });
}
// EPIC W/UI — Historial de signos vitales de UN paciente (vista Signos vitales). Devuelve los puntos
// VITAL_RECORDED (tipo/valor/unidad/fecha) ordenados por fecha desc. La agrupación por timestamp en filas
// (una toma = varios tipos con el mismo occurredAt) y las series de tendencia se derivan en la capa de API. RLS-scoped.
export type VitalPoint=Readonly<{at:string;vitalType:string;value:string;unit:string}>;
export async function patientVitals(ctx:HttpTenantContext,patientId:string,limit=400):Promise<VitalPoint[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select v.occurred_at as at, v.payload->>'vitalType' as vital_type, v.payload->>'value' as value, v.payload->>'unit' as unit
   from clinical_events v
   where v.tenant_id=${ctx.tenantId} and v.aggregate_type='VitalSign' and v.payload->>'kind'='RECORDED' and v.payload->>'patientId'=${patientId}
   order by v.occurred_at desc
   limit ${limit}`;
  // R01-026: constancia de acceso de lectura a PHI (en la misma transacción que la consulta).
  await logPhiAccess(tx,ctx,{resourceType:"PATIENT_VITALS",resourceId:patientId,patientId});
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   at:o.at?new Date(String(o.at)).toISOString():"",vitalType:String(o.vital_type??""),value:String(o.value??""),unit:String(o.unit??"")};});
 });
}
// EPIC X/UI — Metas del plan de cuidados de UN paciente (vista Plan de cuidado). Por cada agregado CarePlan
// toma el evento base CAREPLAN_PROPOSED (categoría/meta) y su ESTADO por la última transición
// (PROPOSED/ACTIVATED/RESUMED->ACTIVE, ON_HOLD, ACHIEVED, CANCELLED). RLS-scoped.
export type CarePlanGoal=Readonly<{carePlanId:string;category:string;goal:string;status:"PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED";recordedAt:string}>;
const CAREPLAN_STATUS:Record<string,"PROPOSED"|"ACTIVE"|"ON_HOLD"|"ACHIEVED"|"CANCELLED">={PROPOSED:"PROPOSED",ACTIVATED:"ACTIVE",RESUMED:"ACTIVE",HELD:"ON_HOLD",ACHIEVED:"ACHIEVED",CANCELLED:"CANCELLED"};
export async function carePlanGoals(ctx:HttpTenantContext,patientId:string):Promise<CarePlanGoal[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'category' as category, a.payload->>'goal' as goal, a.recorded_at as recorded_at,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='CarePlan' and a.payload->>'kind'='PROPOSED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at asc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   carePlanId:String(o.aggregate_id),category:String(o.category??"OTHER"),goal:String(o.goal??""),
   status:CAREPLAN_STATUS[String(o.last_kind??"PROPOSED")]??"PROPOSED",
   recordedAt:o.recorded_at?new Date(String(o.recorded_at)).toISOString():""};});
 });
}
// EPIC BA/UI — Obligaciones de seguimiento de UN paciente (vista Seguimiento › Tareas de seguimiento). Por cada
// agregado ClinicalObligation toma el evento base OBLIGATION_CREATED (tarea/fecha límite) y su ESTADO por la
// última transición (CREATED->OPEN, STARTED->IN_PROGRESS, COMPLETED, CANCELLED). RLS-scoped.
export type FollowUpTask=Readonly<{obligationId:string;task:string;dueAt:string;status:"OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED";priority:string;blocksSignature:SignatureBlockReason|null}>;
export const OBLIGATION_STATUS:Record<string,"OPEN"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED">={CREATED:"OPEN",STARTED:"IN_PROGRESS",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
export async function patientObligations(ctx:HttpTenantContext,patientId:string):Promise<FollowUpTask[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'obligationKind' as task, a.payload->>'dueAt' as due_at, a.payload->>'priority' as priority,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalObligation' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}
   order by a.payload->>'dueAt' asc`;
  const asOf=new Date().toISOString();
  return rows.map(r=>{const o=r as Record<string,unknown>;
   const status=OBLIGATION_STATUS[String(o.last_kind??"CREATED")]??"OPEN";const dueAt=o.due_at?String(o.due_at):"";const priority=o.priority==null?"ROUTINE":String(o.priority);
   return{obligationId:String(o.aggregate_id),task:String(o.task??""),dueAt,status,priority,blocksSignature:signatureBlockReason({state:status,priority,dueAt},asOf)??null};});
 });
}
// EPIC Z/UI — Documentos clínicos de UN paciente (vista Documentos). Por cada agregado ClinicalDocument toma el
// evento base DOCUMENT_CREATED (tipo/título/fecha) y su ESTADO por la última transición
// (CREATED->DRAFT, FINALIZED, SIGNED, AMENDED). RLS-scoped.
export type DocRow=Readonly<{documentId:string;title:string;docType:string;status:"DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED";createdAt:string;actorId:string}>;
const DOC_STATUS:Record<string,"DRAFT"|"FINALIZED"|"SIGNED"|"AMENDED">={CREATED:"DRAFT",FINALIZED:"FINALIZED",SIGNED:"SIGNED",AMENDED:"AMENDED"};
export async function patientDocuments(ctx:HttpTenantContext,patientId:string):Promise<DocRow[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select a.aggregate_id, a.payload->>'title' as title, a.payload->>'docType' as doc_type, a.occurred_at as created_at, a.actor_id as actor_id,
     (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=a.aggregate_id order by sequence desc limit 1) as last_kind
   from clinical_events a
   where a.tenant_id=${ctx.tenantId} and a.aggregate_type='ClinicalDocument' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`;
  return rows.map(r=>{const o=r as Record<string,unknown>;return{
   documentId:String(o.aggregate_id),title:String(o.title??""),docType:String(o.doc_type??"OTHER"),
   status:DOC_STATUS[String(o.last_kind??"CREATED")]??"DRAFT",
   createdAt:o.created_at?new Date(String(o.created_at)).toISOString():"",actorId:String(o.actor_id??"")};});
 });
}
// EPIC AY — Condiciones ACTIVAS del paciente (lista de problemas, CIE-10). RLS-scoped. Para el gate de
// contraindicación fármaco–condición en la prescripción. Activa = último kind ADDED/REACTIVATED/MARKED_CHRONIC
// (no RESOLVED ni MARKED_ERROR). Devuelve el código CIE-10 normalizado.
export async function activeProblemCodes(ctx:HttpTenantContext,patientId:string):Promise<string[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'code' as code
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='ClinicalProblem' and r.payload->>'kind'='ADDED' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id
           and c.payload->>'kind' not in ('EPISTEMIC_CHANGED','EVIDENCE_UPDATED') order by sequence desc limit 1) in ('ADDED','REACTIVATED','MARKED_CHRONIC')`;
  return rows.map(x=>String(x.code??"")).filter(Boolean);
 });
}
