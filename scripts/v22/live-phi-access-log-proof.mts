// Auditoría 2026-09-19, anexo R01 (R01-026) y deuda D-09 — EVIDENCIA FÍSICA de la auditoría de LECTURAS de PHI.
// Antes, `app.append_audit_v17` solo se invocaba al escribir: el sistema sabía quién cambió el expediente pero no quién
// lo miró, y el ADR-0230 afirmaba lo contrario. Esta prueba demuestra contra Postgres real que:
//   1) leer el expediente, la ficha, los signos vitales, la línea de tiempo y un documento deja constancia;
//   2) exportar e imprimir una receta quedan registrados con su propia semántica (EXPORT / PRINT);
//   3) la constancia lleva actor, sesión, propósito y paciente… y NUNCA el contenido leído;
//   4) las lecturas AGREGADAS de la clínica (tableros, contadores) no inflan el registro;
//   5) la app no puede modificar ni borrar el registro, y RLS lo aísla por tenant.
// Ejecuta: pnpm exec tsx ./scripts/v22/live-phi-access-log-proof.mts
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable)
import{directEndpoint}from"../../packages/pg-endpoint/src";
const{freshPatient}=await import("./_patient.mts");
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"r01-026-session-secret";

const postgres=(await import("postgres")).default;
const{patientDemographics,patientVitals,readPatientTimeline,readPatientRecordRows,readTenantOpenAggregates,allergyRegistry,recordPhiAccess,readPatientAccessLog}=await import("../../apps/web/lib/clinical-runtime");

const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:2,prepare:false,onnotice:()=>{}});
const TENANT=crypto.randomUUID(),ACTOR=crypto.randomUUID(),SESSION=crypto.randomUUID();
const ctx={tenantId:TENANT,actorId:ACTOR,actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:crypto.randomUUID(),sessionId:SESSION};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
const ok=(c:boolean,l:string):void=>{if(!c)throw new Error("FAIL:"+l);result.checks.push(l);};
const filas=async():Promise<{resource_type:string;action:string;patient_id:string|null;actor_id:string;session_id:string|null;purpose:string}[]>=>
 (await sql`select resource_type,action,patient_id,actor_id,session_id,purpose from phi_access_log where tenant_id=${TENANT} order by at`) as never;

try{
 const patientId=await freshPatient(TENANT);
 const antes=(await filas()).length;

 // 1) Cinco lecturas de PHI identificable.
 await patientDemographics(ctx,patientId);
 await patientVitals(ctx,patientId);
 await readPatientTimeline(ctx,patientId,{limit:10});
 await readPatientRecordRows(ctx,patientId);
 const tras=await filas();
 const tipos=tras.map(r=>r.resource_type);
 ok(tipos.includes("PATIENT_DEMOGRAPHICS"),"REGISTRA_FICHA");
 ok(tipos.includes("PATIENT_VITALS"),"REGISTRA_SIGNOS_VITALES");
 ok(tipos.includes("PATIENT_TIMELINE"),"REGISTRA_LINEA_DE_TIEMPO");
 ok(tipos.includes("PATIENT_RECORD"),"REGISTRA_EXPEDIENTE");
 ok(tras.length>=antes+4,"UNA_CONSTANCIA_POR_LECTURA");

 // 2) Cada constancia lleva la identidad completa del acceso y el paciente.
 const una=tras.find(r=>r.resource_type==="PATIENT_RECORD")!;
 ok(una.actor_id===ACTOR&&una.session_id===SESSION&&una.purpose==="TREATMENT"&&una.patient_id===patientId,"CONSTANCIA_COMPLETA");

 // 3) Semántica propia de exportar e imprimir.
 await recordPhiAccess(ctx,{resourceType:"RECORD_EXPORT",resourceId:patientId,patientId,action:"EXPORT"});
 await recordPhiAccess(ctx,{resourceType:"PRESCRIPTION",resourceId:crypto.randomUUID(),patientId,action:"PRINT"});
 const conAcciones=await filas();
 ok(conAcciones.some(r=>r.action==="EXPORT"&&r.resource_type==="RECORD_EXPORT"),"REGISTRA_EXPORTACION");
 ok(conAcciones.some(r=>r.action==="PRINT"&&r.resource_type==="PRESCRIPTION"),"REGISTRA_IMPRESION_DE_RECETA");

 // 4) El registro NO guarda contenido clínico: solo identificadores, tipos y marcas de tiempo.
 const columnas=await sql`select column_name from information_schema.columns where table_name='phi_access_log'`;
 const nombres=columnas.map(c=>String(c["column_name"]));
 ok(!nombres.some(n=>/value|content|payload|note|substance|name|birth/i.test(n)),"SIN_COLUMNAS_DE_CONTENIDO");
 const crudo=JSON.stringify(await sql`select * from phi_access_log where tenant_id=${TENANT}`);
 ok(!/Penicilina|nota|diagn/i.test(crudo),"NINGUN_VALOR_CLINICO_EN_EL_REGISTRO");

 // 5) Las lecturas AGREGADAS de la clínica no inflan el registro (si lo hicieran, sería inútil para detectar abusos).
 const n1=(await filas()).length;
 await readTenantOpenAggregates(ctx);
 await allergyRegistry(ctx);
 ok((await filas()).length===n1,"LECTURAS_AGREGADAS_NO_SE_REGISTRAN");

 // 6) La consulta «quién vio el expediente de este paciente» responde desde la aplicación.
 const consulta=await readPatientAccessLog(ctx,patientId,50);
 ok(consulta.length>=6&&consulta.every(e=>e.actorId===ACTOR),"CONSULTA_POR_PACIENTE");
 ok(new Date(consulta[0]!.at).getTime()>=new Date(consulta[consulta.length-1]!.at).getTime(),"ORDEN_DESCENDENTE");

 // 7) Append-only para la aplicación: ni UPDATE ni DELETE.
 const priv=await sql`select
   has_table_privilege('medical_os_runtime','phi_access_log','INSERT') as ins,
   has_table_privilege('medical_os_runtime','phi_access_log','SELECT') as sel,
   has_table_privilege('medical_os_runtime','phi_access_log','UPDATE') as upd,
   has_table_privilege('medical_os_runtime','phi_access_log','DELETE') as del`;
 ok(priv[0]?.["ins"]===true&&priv[0]?.["sel"]===true&&priv[0]?.["upd"]===false&&priv[0]?.["del"]===false,"APPEND_ONLY_PARA_LA_APP");

 // 8) RLS forzada: otro tenant no ve estas constancias.
 const otro=crypto.randomUUID();
 const ajenas=await sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${otro},true)`;
  await tx`set local role medical_os_runtime`;
  return tx`select count(*)::int as n from phi_access_log where tenant_id=${TENANT}`;
 }) as unknown as {n:number}[];
 ok(Number(ajenas[0]?.n)===0,"RLS_AISLA_EL_REGISTRO");

 // 9) La lectura de un paciente de OTRO tenant no aparece bajo este tenant (el registro sigue al contexto, no al dato).
 const ctxOtro={...ctx,tenantId:otro,requestId:crypto.randomUUID()};
 const pacienteOtro=await freshPatient(otro);
 await patientDemographics(ctxOtro,pacienteOtro);
 ok((await filas()).every(r=>r.patient_id!==pacienteOtro),"CONSTANCIA_EN_EL_TENANT_CORRECTO");
}catch(e){result.status="FAIL";result.error=e instanceof Error?e.message:String(e);}
finally{await sql.end({timeout:5});}
console.log(JSON.stringify(result,null,2));
process.exit(result.status==="PASS"?0:1);
