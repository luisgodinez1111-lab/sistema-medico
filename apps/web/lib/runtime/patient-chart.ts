// Expediente VIVO — read-model por paciente que hidrata TODOS los módulos del expediente con su historia real.
//
// El problema que resuelve (auditoría de modelo de datos, "la brecha madre"): el front arrancaba cada módulo del
// expediente con `useState([])` y solo lo llenaba con lo que el médico creaba EN esa sesión; nunca rehidrataba la
// historia. Resultado: abrías a un paciente con años de expediente y Problemas/Alergias/Medicación/Signos salían
// vacíos. Se "sentía muerto". Este lector cierra esa brecha: por paciente, trae cada agregado con su ESTADO (última
// transición de ciclo de vida) y su VERSIÓN (nº de eventos) — la versión es la clave que faltaba para que la UI no solo
// LEA sino que pueda TRANSICIONAR lo leído (If-Match / concurrencia optimista), igual que ya hacía `ordersRegistry`.
//
// Es READ-ONLY y RLS-scoped. Reutiliza las piezas SQL de `read-model-joins` (no toca los registries clínica-wide ni sus
// tests). El conjunto SIEMPRE va acotado por paciente, así que los LATERAL (versión, transición) cuestan por fila
// devuelta, no por tenant (ver la medición en read-model-joins.ts).
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{resolveDrug}from"../../../../packages/drug-catalog/src";
import{vaccineLabel}from"../../../../packages/immunization-schedule/src";
import{withTenantTx}from"./connection";
import{ultimaTransicion,versionDelAgregado}from"./read-model-joins";

// Filas con la forma EXACTA que consumen los módulos del expediente (apps/web/app/workspace/shared.tsx): id+label+state+version.
export type ChartRow=Readonly<{id:string;label:string;state:string;version:number;problemLabel?:string;encounterId?:string}>;// problemLabel: POMR; encounterId: acto en que se creó
export type ChartVital=Readonly<{id:string;vitalType:string;value:string;unit:string;state:string;version:number;vstatus:string;interp:string;encounterId?:string}>;
export type ChartResult=Readonly<{id:string;label:string;critical:boolean;state:string;version:number}>;
export type PatientChart=Readonly<{
 problems:ChartRow[];allergies:ChartRow[];medications:ChartRow[];vitals:ChartVital[];
 immunizations:ChartRow[];orders:ChartRow[];results:ChartResult[];
 // Coordinación + Plan (hidratados para que el expediente no sea islas y las obligaciones que bloquean la firma sean accionables):
 obligations:ChartRow[];referrals:ChartRow[];appointments:ChartRow[];consents:ChartRow[];carePlans:ChartRow[];
}>;

// Mapas kind→ESTADO del frontend (no el del registry clínica-wide, que usa otro vocabulario). El último kind de ciclo de
// vida ES el estado del agregado (ADR-0240 §2: las anotaciones no cambian el estado y se excluyen de `kinds`).
const PROB:Record<string,string>={ADDED:"ACTIVE",REACTIVATED:"ACTIVE",MARKED_CHRONIC:"CHRONIC",RESOLVED:"RESOLVED",ENTERED_IN_ERROR:"ENTERED_IN_ERROR"};
const ALG:Record<string,string>={RECORDED:"ACTIVE",REACTIVATED:"ACTIVE",REFUTED:"REFUTED",INACTIVATED:"INACTIVE"};
const MED:Record<string,string>={PROPOSED:"PROPOSED",PRESCRIBED:"PRESCRIBED",ACTIVATED:"ACTIVE",RESUMED:"ACTIVE",HELD:"HELD",STOPPED:"STOPPED",CANCELLED:"STOPPED"};
const IMM:Record<string,string>={DUE:"DUE",ADMINISTERED:"ADMINISTERED",REFUSED:"REFUSED",ADVERSE_EVENT:"ADVERSE_EVENT"};
const ORD:Record<string,string>={CREATED:"DRAFT",PLACED:"ORDERED",FULFILLED:"FULFILLED",CANCELLED:"CANCELLED"};
const RES:Record<string,string>={RECEIVED:"RECEIVED",VERIFIED:"VERIFIED",ACTIONED:"ACTIONED",CLOSED:"CLOSED"};
const VIT:Record<string,string>={RECORDED:"RECORDED",AMENDED:"AMENDED",ENTERED_IN_ERROR:"ENTERED_IN_ERROR"};
// Módulos de Coordinación + Plan del expediente (antes NO se hidrataban: arrancaban vacíos para un paciente que regresaba,
// y una obligación de seguimiento que bloqueaba la firma no tenía fila accionable — callejón sin salida). Mismo patrón que
// arriba: último kind => estado de la UI, versión = nº de eventos (If-Match para poder TRANSICIONAR lo leído).
const OBL:Record<string,string>={CREATED:"OPEN",STARTED:"IN_PROGRESS",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
const REF:Record<string,string>={REQUESTED:"REQUESTED",ACCEPTED:"ACCEPTED",DECLINED:"DECLINED",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED"};
const APPT:Record<string,string>={SCHEDULED:"SCHEDULED",CHECKED_IN:"CHECKED_IN",COMPLETED:"COMPLETED",CANCELLED:"CANCELLED",NO_SHOW:"NO_SHOW"};
const CONS:Record<string,string>={DRAFTED:"DRAFTED",PRESENTED:"PRESENTED",GRANTED:"GRANTED",DECLINED:"DECLINED",REVOKED:"REVOKED"};
const CPL:Record<string,string>={PROPOSED:"PROPOSED",ACTIVATED:"ACTIVE",HELD:"ON_HOLD",RESUMED:"ACTIVE",ACHIEVED:"ACHIEVED",CANCELLED:"CANCELLED"};

const str=(o:Record<string,unknown>,k:string)=>o[k]==null?"":String(o[k]);

/** Hidrata el expediente de UN paciente: una consulta por módulo, acotada por paciente, con estado y versión. */
export async function patientChart(ctx:HttpTenantContext,patientId:string):Promise<PatientChart>{
 return withTenantTx(ctx,async tx=>{
  const t=ctx.tenantId;
  // POMR: etiqueta del problema enlazado (medicación/órdenes traen `problemId`). LATERAL por fila; si no hay problemId
  // (o el problema no existe), devuelve null y no se enlaza. problemId viene validado como uuid del write-side.
  const probLink=tx`left join lateral (select p.payload->>'code' as pcode, p.payload->>'description' as pdesc from clinical_events p
    where p.tenant_id=${t} and p.aggregate_type='ClinicalProblem' and p.payload->>'kind'='ADDED'
      and p.aggregate_id=(a.payload->>'problemId')::uuid limit 1) prob on true`;
  const problemLabelOf=(o:Record<string,unknown>)=>{const c=str(o,"pcode"),d=str(o,"pdesc");const l=[c,d].filter(Boolean).join(" · ");return l||undefined;};
  const encSpread=(o:Record<string,unknown>)=>{const e=str(o,"encounter_id");return e?{encounterId:e}:{};};// acto (encuentro) en que se creó la fila
  // PROBLEMAS — base PROBLEM_ADDED; estado por última transición de ciclo de vida.
  const problems=(await tx`
   select a.aggregate_id as id, a.payload->>'code' as code, a.payload->>'description' as description, a.payload->>'encounterId' as encounter_id, lk.kind as last_kind, vr.version as version
   from clinical_events a ${ultimaTransicion(tx,t,Object.keys(PROB))} ${versionDelAgregado(tx,t)}
   where a.tenant_id=${t} and a.aggregate_type='ClinicalProblem' and a.payload->>'kind'='ADDED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;const code=str(o,"code"),desc=str(o,"description");
   return{id:str(o,"id"),label:[code,desc].filter(Boolean).join(" · ")||code||desc||"Problema",state:PROB[str(o,"last_kind")||"ADDED"]??"ACTIVE",version:Number(o.version??1),...encSpread(o)};});
  // ALERGIAS — base ALLERGY_RECORDED.
  const allergies=(await tx`
   select a.aggregate_id as id, a.payload->>'substance' as substance, a.payload->>'reaction' as reaction, lk.kind as last_kind, vr.version as version
   from clinical_events a ${ultimaTransicion(tx,t,Object.keys(ALG))} ${versionDelAgregado(tx,t)}
   where a.tenant_id=${t} and a.aggregate_type='Allergy' and a.payload->>'kind'='RECORDED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;const sub=str(o,"substance"),reac=str(o,"reaction");
   return{id:str(o,"id"),label:reac?`${sub} — ${reac}`:(sub||"Alergia"),state:ALG[str(o,"last_kind")||"RECORDED"]??"ACTIVE",version:Number(o.version??1)};});
  // MEDICACIÓN — base MEDICATION_PROPOSED; nombre legible del catálogo (resolveDrug), no el código crudo.
  const medications=(await tx`
   select a.aggregate_id as id, a.payload->>'drugCode' as drug, a.payload->>'dose' as dose, a.payload->>'encounterId' as encounter_id, lk.kind as last_kind, vr.version as version, prob.pcode as pcode, prob.pdesc as pdesc
   from clinical_events a ${ultimaTransicion(tx,t,Object.keys(MED))} ${versionDelAgregado(tx,t)} ${probLink}
   where a.tenant_id=${t} and a.aggregate_type='Medication' and a.payload->>'kind'='PROPOSED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;const code=str(o,"drug");const name=resolveDrug(code)?.ingredient??code;const dose=str(o,"dose");const pl=problemLabelOf(o);
   return{id:str(o,"id"),label:[name,dose].filter(Boolean).join(" "),state:MED[str(o,"last_kind")||"PROPOSED"]??"PROPOSED",version:Number(o.version??1),...(pl?{problemLabel:pl}:{}),...encSpread(o)};});
  // VACUNAS — base IMMUNIZATION_DUE; nombre legible del esquema.
  const immunizations=(await tx`
   select a.aggregate_id as id, a.payload->>'vaccineCode' as vaccine, a.payload->>'dose' as dose, lk.kind as last_kind, vr.version as version
   from clinical_events a ${ultimaTransicion(tx,t,Object.keys(IMM))} ${versionDelAgregado(tx,t)}
   where a.tenant_id=${t} and a.aggregate_type='Immunization' and a.payload->>'kind'='DUE' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;const vac=str(o,"vaccine"),dose=str(o,"dose");
   return{id:str(o,"id"),label:dose?`${vaccineLabel(vac)} · dosis ${dose}`:vaccineLabel(vac),state:IMM[str(o,"last_kind")||"DUE"]??"DUE",version:Number(o.version??1)};});
  // ÓRDENES — base ORDER_CREATED.
  const orders=(await tx`
   select a.aggregate_id as id, a.payload->>'orderType' as order_type, a.payload->>'detail' as detail, a.payload->>'encounterId' as encounter_id, lk.kind as last_kind, vr.version as version, prob.pcode as pcode, prob.pdesc as pdesc
   from clinical_events a ${ultimaTransicion(tx,t,Object.keys(ORD))} ${versionDelAgregado(tx,t)} ${probLink}
   where a.tenant_id=${t} and a.aggregate_type='ClinicalOrder' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;const ot=str(o,"order_type"),det=str(o,"detail");const pl=problemLabelOf(o);
   return{id:str(o,"id"),label:det?`${ot}: ${det}`:(ot||"Orden"),state:ORD[str(o,"last_kind")||"CREATED"]??"DRAFT",version:Number(o.version??1),...(pl?{problemLabel:pl}:{}),...encSpread(o)};});
  // RESULTADOS — base DIAGNOSTIC_RESULT RECEIVED. Se excluyen (igual que TODOS los demás lectores de laboratorio —
  // lab-facts.latestAnalyteReading/analyteSeries y records.countOpenCriticalResults): los ANULADOS (ENTERED_IN_ERROR) y los
  // CORREGIDOS, es decir los superados por un resultado nuevo con `supersedes` (C-02). Sin esto el chart mostraba el valor
  // viejo —con su flag `critical` retractado— como vigente y duplicado, contradiciendo la corrección que lo desmintió.
  const results=(await tx`
   select a.aggregate_id as id, a.payload->>'analyte' as analyte, a.payload->>'value' as value, a.payload->>'critical' as critical, lk.kind as last_kind, vr.version as version
   from clinical_events a ${ultimaTransicion(tx,t,Object.keys(RES))} ${versionDelAgregado(tx,t)}
   left join lateral (select 1 as anulado from clinical_events v where v.tenant_id=${t} and v.aggregate_id=a.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR' limit 1) anul on true
   where a.tenant_id=${t} and a.aggregate_type='DiagnosticResult' and a.payload->>'kind'='RECEIVED' and a.payload->>'patientId'=${patientId} and anul.anulado is null
     and not exists(select 1 from clinical_events s where s.tenant_id=${t} and s.aggregate_type='DiagnosticResult' and s.payload->>'kind'='RECEIVED' and s.payload->>'supersedes'=a.aggregate_id::text)
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;const an=str(o,"analyte"),val=str(o,"value");
   return{id:str(o,"id"),label:val?`${an}: ${val}`:(an||"Resultado"),critical:String(o.critical)==="true",state:RES[str(o,"last_kind")||"RECEIVED"]??"RECEIVED",version:Number(o.version??1)};});
  // SIGNOS VITALES — base VITAL_RECORDED; valor VIGENTE (último RECORDED/AMENDED); se excluyen los capturados por error.
  const vitals=(await tx`
   select a.aggregate_id as id, a.payload->>'vitalType' as vital_type, a.payload->>'encounterId' as encounter_id,
     coalesce(cur.value,a.payload->>'value') as value, coalesce(cur.unit,a.payload->>'unit') as unit,
     coalesce(cur.status,a.payload->>'status') as vstatus, coalesce(cur.interp,a.payload->>'interpretation') as interp,
     lk.kind as last_kind, vr.version as version
   from clinical_events a
   ${ultimaTransicion(tx,t,Object.keys(VIT))} ${versionDelAgregado(tx,t)}
   left join lateral (select e.payload->>'value' as value, e.payload->>'unit' as unit, e.payload->>'status' as status, e.payload->>'interpretation' as interp
     from clinical_events e where e.tenant_id=${t} and e.aggregate_id=a.aggregate_id and e.payload->>'kind' in ('RECORDED','AMENDED') order by e.sequence desc limit 1) cur on true
   left join lateral (select 1 as eie from clinical_events v where v.tenant_id=${t} and v.aggregate_id=a.aggregate_id and v.payload->>'kind'='ENTERED_IN_ERROR' limit 1) er on true
   where a.tenant_id=${t} and a.aggregate_type='VitalSign' and a.payload->>'kind'='RECORDED' and a.payload->>'patientId'=${patientId} and er.eie is null
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;
   return{id:str(o,"id"),vitalType:str(o,"vital_type"),value:str(o,"value"),unit:str(o,"unit"),state:VIT[str(o,"last_kind")||"RECORDED"]??"RECORDED",version:Number(o.version??1),vstatus:str(o,"vstatus"),interp:str(o,"interp"),...encSpread(o)};});
  // OBLIGACIONES DE SEGUIMIENTO — base OBLIGATION_CREATED. Sin esto, una obligación que BLOQUEA la firma no tenía fila
  // accionable en el expediente (dead-end). El label es su tipo (obligationKind); el estado, la última transición.
  const obligations=(await tx`
   select a.aggregate_id as id, a.payload->>'obligationKind' as label, lk.kind as last_kind, vr.version as version
   from clinical_events a ${ultimaTransicion(tx,t,Object.keys(OBL))} ${versionDelAgregado(tx,t)}
   where a.tenant_id=${t} and a.aggregate_type='ClinicalObligation' and a.payload->>'kind'='CREATED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;
   return{id:str(o,"id"),label:str(o,"label")||"Obligación de seguimiento",state:OBL[str(o,"last_kind")||"CREATED"]??"OPEN",version:Number(o.version??1)};});
  // INTERCONSULTAS — base REFERRAL_REQUESTED. label = especialidad + motivo.
  const referrals=(await tx`
   select a.aggregate_id as id, a.payload->>'specialty' as specialty, a.payload->>'reason' as reason, lk.kind as last_kind, vr.version as version
   from clinical_events a ${ultimaTransicion(tx,t,Object.keys(REF))} ${versionDelAgregado(tx,t)}
   where a.tenant_id=${t} and a.aggregate_type='Referral' and a.payload->>'kind'='REQUESTED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;const sp=str(o,"specialty"),re=str(o,"reason");
   return{id:str(o,"id"),label:sp?(re?`${sp}: ${re}`:sp):(re||"Interconsulta"),state:REF[str(o,"last_kind")||"REQUESTED"]??"REQUESTED",version:Number(o.version??1)};});
  // CITAS — base APPOINTMENT_SCHEDULED. label = motivo + fecha.
  const appointments=(await tx`
   select a.aggregate_id as id, a.payload->>'reason' as reason, a.payload->>'startAt' as start_at, lk.kind as last_kind, vr.version as version
   from clinical_events a ${ultimaTransicion(tx,t,Object.keys(APPT))} ${versionDelAgregado(tx,t)}
   where a.tenant_id=${t} and a.aggregate_type='Appointment' and a.payload->>'kind'='SCHEDULED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;const re=str(o,"reason"),at=str(o,"start_at");
   const when=at?new Date(at).toLocaleString("es-MX",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"";
   return{id:str(o,"id"),label:re?(when?`${re} · ${when}`:re):(when||"Cita"),state:APPT[str(o,"last_kind")||"SCHEDULED"]??"SCHEDULED",version:Number(o.version??1)};});
  // CONSENTIMIENTOS — base CONSENT_DRAFTED. label = tipo/alcance.
  const consents=(await tx`
   select a.aggregate_id as id, a.payload->>'scopeType' as scope, lk.kind as last_kind, vr.version as version
   from clinical_events a ${ultimaTransicion(tx,t,Object.keys(CONS))} ${versionDelAgregado(tx,t)}
   where a.tenant_id=${t} and a.aggregate_type='Consent' and a.payload->>'kind'='DRAFTED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;
   return{id:str(o,"id"),label:str(o,"scope")||"Consentimiento",state:CONS[str(o,"last_kind")||"DRAFTED"]??"DRAFTED",version:Number(o.version??1)};});
  // PLAN DE CUIDADOS — base CAREPLAN_PROPOSED. label = categoría + meta.
  const carePlans=(await tx`
   select a.aggregate_id as id, a.payload->>'category' as category, a.payload->>'goal' as goal, lk.kind as last_kind, vr.version as version
   from clinical_events a ${ultimaTransicion(tx,t,Object.keys(CPL))} ${versionDelAgregado(tx,t)}
   where a.tenant_id=${t} and a.aggregate_type='CarePlan' and a.payload->>'kind'='PROPOSED' and a.payload->>'patientId'=${patientId}
   order by a.occurred_at desc`).map(r=>{const o=r as Record<string,unknown>;const cat=str(o,"category"),goal=str(o,"goal");
   return{id:str(o,"id"),label:cat?(goal?`${cat}: ${goal}`:cat):(goal||"Plan de cuidados"),state:CPL[str(o,"last_kind")||"PROPOSED"]??"PROPOSED",version:Number(o.version??1)};});
  return{problems,allergies,medications,vitals,immunizations,orders,results,obligations,referrals,appointments,consents,carePlans};
 });
}
