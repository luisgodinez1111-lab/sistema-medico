// `pnpm phi:retention` — INFORME (solo lectura) de retención de PHI por paciente (auditoría D-09, ADR-0280).
// Por cada paciente del tenant indicado: fecha del último acto clínico, años transcurridos, si superó la retención mínima
// (NOM-004: 5 años) y si tiene solicitud de cancelación (evento ERASURE_REQUESTED). NO borra nada: la purga física exige
// las decisiones de ADR-0280 y quedará detrás de `--purge --yes` + PHI_PURGE_ALLOW=1 cuando se implemente.
// Uso: DATABASE_URL=<propietario> pnpm phi:retention --tenant <uuid> [--years 5] [--json]
import{parseArgs}from"node:util";
import{directEndpoint}from"../../packages/pg-endpoint/src";
const{values:a}=parseArgs({args:process.argv.slice(2).filter(a=>a!=="--"),options:{tenant:{type:"string"},years:{type:"string",default:"5"},json:{type:"boolean",default:false},purge:{type:"boolean",default:false}}});
if(a.purge){console.error("La purga física no está implementada: requiere las decisiones de docs/adr/ADR-0280-retencion-y-borrado-de-phi.md (criptoborrado vs. purga, plazos, ARCO).");process.exit(2);}
if(!a.tenant||!/^[0-9a-f-]{36}$/i.test(a.tenant)){console.error("Uso: pnpm phi:retention --tenant <uuid> [--years 5] [--json]");process.exit(2);}
const url=process.env.DATABASE_URL;if(!url){console.error("DATABASE_URL requerida (rol propietario, solo lectura en este informe)");process.exit(2);}
const years=Number(a.years);if(!Number.isFinite(years)||years<5){console.error("--years no puede ser menor que 5 (NOM-004-SSA3-2012, 5.4)");process.exit(2);}
const{default:postgres}=await import("postgres");
const sql=postgres(directEndpoint(url),{max:1,prepare:false,onnotice:()=>{}});
try{
 const rows=await sql`
  with pacientes as (
   select aggregate_id as patient_id from clinical_events where tenant_id=${a.tenant} and aggregate_type='Patient' and payload->>'kind'='REGISTERED'
  ), actos as (
   select coalesce((e.payload->>'patientId')::uuid, case when e.aggregate_type='Patient' then e.aggregate_id end) as patient_id, max(e.occurred_at) as last_act
   from clinical_events e where e.tenant_id=${a.tenant} group by 1
  ), solicitudes as (
   select aggregate_id as patient_id, min(occurred_at) as requested_at from clinical_events
   where tenant_id=${a.tenant} and aggregate_type='Patient' and payload->>'kind'='ERASURE_REQUESTED' group by 1
  )
  select p.patient_id, a.last_act, s.requested_at,
   extract(epoch from (now()-a.last_act))/31557600.0 as years_since_last_act
  from pacientes p left join actos a on a.patient_id=p.patient_id left join solicitudes s on s.patient_id=p.patient_id
  order by a.last_act asc nulls first`;
 const report=rows.map(r=>{const o=r as{patient_id:string;last_act:Date|null;requested_at:Date|null;years_since_last_act:string|null};const y=o.years_since_last_act===null?null:Number(o.years_since_last_act);
  return{patientId:o.patient_id,lastClinicalAct:o.last_act?new Date(o.last_act).toISOString():null,yearsSinceLastAct:y===null?null:Math.round(y*100)/100,pastRetention:y!==null&&y>=years,erasureRequestedAt:o.requested_at?new Date(o.requested_at).toISOString():null};});
 const summary={tenantId:a.tenant,retentionYears:years,patients:report.length,pastRetention:report.filter(x=>x.pastRetention).length,withErasureRequest:report.filter(x=>x.erasureRequestedAt).length,purgeAvailable:false,note:"Informe de solo lectura (ADR-0280). Los identificadores de paciente no son PHI por sí solos; no imprima este informe junto con nombres."};
 if(a.json)console.log(JSON.stringify({summary,report},null,2));else{console.table(report.slice(0,50));console.log(JSON.stringify(summary));}
}finally{await sql.end();}
