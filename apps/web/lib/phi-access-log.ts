import type{TransactionSql}from"postgres";
import type{HttpTenantContext}from"../../../packages/http-principal/src";
// Auditoría 2026-09-19, anexo R01 (R01-026) y deuda D-09 — registro de LECTURAS de PHI.
//
// Se registra el acceso a PHI de un paciente IDENTIFICABLE: el expediente completo, la ficha demográfica, los signos
// vitales, el detalle de un documento, la exportación y la receta impresa. NO se registran los agregados de la clínica
// (contadores, tableros, registros por estado) ni las lecturas internas que el propio servidor hace para decidir una
// barrera de seguridad: inflar el registro con eso lo volvería inútil para detectar un acceso indebido.
//
// La escritura va en la MISMA transacción que la lectura: si la lectura ocurre, la huella existe; si la transacción
// falla, no queda una huella de algo que nadie llegó a ver.
export type PhiResourceType=
 |"PATIENT_RECORD"      // expediente completo (todos los eventos del paciente)
 |"PATIENT_DEMOGRAPHICS"// ficha de identidad
 |"PATIENT_TIMELINE"    // línea de tiempo longitudinal
 |"PATIENT_VITALS"      // serie de signos vitales
 |"CLINICAL_DOCUMENT"   // contenido de un documento clínico
 |"PRESCRIPTION"        // receta (impresión / PDF)
 |"RECORD_EXPORT";      // exportación del expediente
export type PhiAccessAction="READ"|"EXPORT"|"PRINT";

/**
 * Deja constancia de un acceso de lectura a PHI. `resourceId` es el agregado consultado (el propio paciente cuando el
 * recurso es el expediente); `patientId` es siempre el paciente cuya información se expuso, para poder responder
 * «¿quién ha visto el expediente de esta persona?» sin recorrer todas las filas.
 */
export async function logPhiAccess(tx:TransactionSql,ctx:HttpTenantContext,a:Readonly<{
 resourceType:PhiResourceType;resourceId:string;patientId?:string|undefined;action?:PhiAccessAction;
}>):Promise<void>{
 await tx`insert into phi_access_log(tenant_id,actor_id,session_id,purpose,request_id,resource_type,resource_id,patient_id,action)
  values(${ctx.tenantId},${ctx.actorId},${ctx.sessionId??null},${ctx.purpose},${ctx.requestId},${a.resourceType},${a.resourceId},${a.patientId??null},${a.action??"READ"})`;
}

export type PhiAccessEntry=Readonly<{
 at:string;actorId:string;sessionId:string|null;purpose:string;resourceType:string;resourceId:string;patientId:string|null;action:string;
}>;
/** Accesos registrados al expediente de un paciente, del más reciente al más antiguo (para el panel de auditoría). */
export async function patientAccessLog(tx:TransactionSql,ctx:HttpTenantContext,patientId:string,limit=100):Promise<PhiAccessEntry[]>{
 const rows=await tx`
  select at, actor_id, session_id, purpose, resource_type, resource_id, patient_id, action
  from phi_access_log
  where tenant_id=${ctx.tenantId} and (patient_id=${patientId} or resource_id=${patientId})
  order by at desc limit ${Math.min(Math.max(limit,1),500)}`;
 return rows.map(r=>({
  at:new Date(String(r["at"])).toISOString(),actorId:String(r["actor_id"]),
  sessionId:r["session_id"]==null?null:String(r["session_id"]),purpose:String(r["purpose"]),
  resourceType:String(r["resource_type"]),resourceId:String(r["resource_id"]),
  patientId:r["patient_id"]==null?null:String(r["patient_id"]),action:String(r["action"]),
 }));
}
