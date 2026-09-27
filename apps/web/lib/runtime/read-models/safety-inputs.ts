// Lote 11 (ADR-0300) — entradas de las barreras de prescripción (alergias, medicación y problemas activos). Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.
import{type HttpTenantContext}from"../../../../../packages/http-principal/src";
import{withTenantTx}from"../db";
// EPIC R — Gate de seguridad de medicación: sustancias con alergia ACTIVA del paciente (RLS-scoped).
// Una alergia está activa si su último evento es RECORDED o REACTIVATED (no REFUTED/INACTIVATED).
// Auditoría C-06: la barrera necesita GRAVEDAD y REACCIÓN, no solo la sustancia (una intolerancia leve no es una anafilaxia).
export type ActiveAllergy=Readonly<{substance:string;severity:"MILD"|"MODERATE"|"SEVERE"|null;reaction:string|null}>;
export async function activeAllergies(ctx:HttpTenantContext,patientId:string):Promise<ActiveAllergy[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'substance' as substance, r.payload->>'severity' as severity, r.payload->>'reaction' as reaction
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Allergy' and r.payload->>'kind'='RECORDED' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) in ('RECORDED','REACTIVATED')`;
  return rows.map(x=>{const sev=String(x.severity??"");return{substance:String(x.substance??""),severity:sev==="MILD"||sev==="MODERATE"||sev==="SEVERE"?sev:null,reaction:x.reaction==null?null:String(x.reaction)};}).filter(a=>a.substance);
 }) as Promise<ActiveAllergy[]>;
}
export async function activeAllergySubstances(ctx:HttpTenantContext,patientId:string):Promise<string[]>{
 return withTenantTx(ctx,async tx=>{
  const rows=await tx`
   select r.payload->>'substance' as substance
   from clinical_events r
   where r.tenant_id=${ctx.tenantId} and r.aggregate_type='Allergy' and r.payload->>'kind'='RECORDED' and r.payload->>'patientId'=${patientId}
     and (select payload->>'kind' from clinical_events c where c.tenant_id=${ctx.tenantId} and c.aggregate_id=r.aggregate_id order by sequence desc limit 1) in ('RECORDED','REACTIVATED')`;
  return rows.map(x=>String(x.substance??"")).filter(Boolean);
 }) as Promise<string[]>;
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
 }) as Promise<string[]>;
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
 }) as Promise<string[]>;
}
