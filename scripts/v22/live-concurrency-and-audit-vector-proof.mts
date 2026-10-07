// Auditoría 2026-09-19, anexo R06 (vacíos F14 y F13) — Evidencia física de dos invariantes que solo se pueden probar
// contra una base real:
//
//  · F14 — CONCURRENCIA OPTIMISTA. `aggregate_versions` implementa la versión esperada por agregado, pero no había ninguna
//    prueba de CARRERA: dos comandos con el MISMO `expectedVersion` lanzados a la vez. Sin ella, «la concurrencia está
//    resuelta» era una afirmación sobre el diseño, no sobre el comportamiento. Aquí se lanzan de verdad con Promise.all y
//    se exige que gane EXACTAMENTE uno y que el otro reciba CONCURRENCY_CONFLICT — y que la traducción HTTP sea 409.
//
//  · F13 — CADENA DE HASH DE AUDITORÍA. `app.append_audit_v17` encadena cada entrada con la anterior, pero el hash se
//    verificaba comparando la función consigo misma. Aquí se calcula el digest esperado FUERA de Postgres (en Node, con la
//    misma definición: sha256 del objeto {tenant,sequence,id,previousHash,actor,action,resource,payload}) y se compara.
//    Es la verificación independiente que faltaba, y queda como VECTOR GOLDEN versionado en el repositorio.
import crypto from"node:crypto";
import{libro}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
import postgres from"postgres";
import{directEndpoint}from"../../packages/pg-endpoint/src";
const{executeAtomicClinicalCommand}=await import("../../packages/atomic-clinical-transaction-v3/src");
const{deterministicUuid}=await import("../../packages/canonical-json/src");
const{toHttpError}=await import("../../apps/web/lib/http-errors");
const{ClinicalError}=await import("../../packages/runtime-errors/src");
const URL_DB=process.env.TEST_DATABASE_URL!;
const sql=postgres(directEndpoint(URL_DB),{max:4,prepare:false,onnotice:()=>{}});
const TENANT=crypto.randomUUID(),ACTOR=crypto.randomUUID();
const ctx={tenantId:TENANT,actorId:ACTOR,actorType:"SYSTEM" as const,purpose:"TREATMENT",requestId:crypto.randomUUID()};
const{result,ok,fin}=libro<{vector:unknown}>();
const cmd=(agg:string,expectedVersion:number,seed:string)=>({
 commandId:deterministicUuid(seed+":cmd"),idempotencyKey:seed,aggregateId:agg,aggregateType:"Encounter",expectedVersion,
 eventId:deterministicUuid(seed+":ev"),eventType:"ENCOUNTER_OPENED",payload:{kind:"OPENED",patientId:deterministicUuid(seed+":pat"),seed},
 outboxId:deterministicUuid(seed+":out"),topic:"encounter.opened",auditId:deterministicUuid(seed+":aud"),
 correlationId:deterministicUuid(seed+":corr"),occurredAt:new Date().toISOString(),
});
try{
 // ---------- F14: carrera real sobre la misma versión esperada ----------
 const agg=crypto.randomUUID();
 const a=executeAtomicClinicalCommand(sql,ctx,cmd(agg,0,`race-a-${agg}`) as never);
 const b=executeAtomicClinicalCommand(sql,ctx,cmd(agg,0,`race-b-${agg}`) as never);
 const res=await Promise.allSettled([a,b]);
 const ganadores=res.filter(r=>r.status==="fulfilled");
 const perdedores=res.filter((r):r is PromiseRejectedResult=>r.status==="rejected");
 ok(ganadores.length===1,`EXACTLY_ONE_WINS:${ganadores.length}`);
 ok(perdedores.length===1&&/CONCURRENCY_CONFLICT/.test(String((perdedores[0]!.reason as Error).message)),"LOSER_GETS_CONCURRENCY_CONFLICT");
 // Y la versión del agregado avanzó UNA sola vez: no hay dos eventos con la misma secuencia.
 const v=await sql.begin(async tx=>{await tx`select set_config('app.tenant_id',${TENANT},true)`;return tx`select version from aggregate_versions where tenant_id=${TENANT} and aggregate_id=${agg}`;});
 ok(Number((v[0] as{version:number}).version)===1,"VERSION_ADVANCED_ONCE");
 const ev=await sql.begin(async tx=>{await tx`select set_config('app.tenant_id',${TENANT},true)`;return tx`select count(*)::int n from clinical_events where tenant_id=${TENANT} and aggregate_id=${agg}`;});
 ok(Number((ev[0] as{n:number}).n)===1,"ONLY_ONE_EVENT_PERSISTED");
 // La traducción HTTP del conflicto es 409 (y no un 500 genérico).
 const h=toHttpError(new ClinicalError("CONCURRENCY_CONFLICT","Aggregate changed since last read"));
 ok(h.status===409&&h.body.error.code==="CONCURRENCY_CONFLICT","CONFLICT_MAPS_TO_HTTP_409");

 // Tres comandos a la vez sobre el mismo agregado: gana uno, pierden dos.
 const agg2=crypto.randomUUID();
 const tres=await Promise.allSettled([0,1,2].map(i=>executeAtomicClinicalCommand(sql,ctx,cmd(agg2,0,`race3-${i}-${agg2}`) as never)));
 ok(tres.filter(r=>r.status==="fulfilled").length===1,"THREE_WAY_RACE_ONE_WINNER");
 ok(tres.filter(r=>r.status==="rejected").every(r=>/CONCURRENCY_CONFLICT/.test(String((r as PromiseRejectedResult).reason))),"THREE_WAY_LOSERS_ALL_CONFLICT");

 // ---------- F13: verificación INDEPENDIENTE de la cadena de auditoría ----------
 // Se recalcula el digest en Node y se compara con el que devolvió Postgres. Si alguien cambia la definición del hash en
 // la función SQL sin cambiar esta prueba, la comparación falla: es la verificación externa que faltaba.
 const filas=await sql.begin(async tx=>{
  await tx`select set_config('app.tenant_id',${TENANT},true)`;
  return tx`select sequence,id,previous_hash,entry_hash,actor_id,action,resource,payload from audit_chain_v3 where tenant_id=${TENANT} order by sequence`;
 });
 ok(filas.length>=2,`AUDIT_CHAIN_HAS_ENTRIES:${filas.length}`);
 const digestEsperado=(r:Record<string,unknown>):string=>{
  // MISMA definición que app.append_audit_v17: sha256 del texto del objeto jsonb, con las claves en este orden.
  const obj={tenant:TENANT,sequence:Number(r["sequence"]),id:String(r["id"]),previousHash:r["previous_hash"]===null?null:String(r["previous_hash"]),
   actor:String(r["actor_id"]),action:String(r["action"]),resource:String(r["resource"]),payload:r["payload"]};
  // `jsonb_build_object(...)::text` en Postgres ordena las claves del jsonb; se reproduce con el mismo orden de jsonb.
  return crypto.createHash("sha256").update(jsonbText(obj),"utf8").digest("hex");
 };
 // jsonb ordena las claves por longitud y luego lexicográficamente, y no deja espacios: se reproduce aquí.
 function jsonbText(v:unknown):string{
  if(v===null)return"null";
  if(Array.isArray(v))return"["+v.map(jsonbText).join(", ")+"]";
  if(typeof v==="object"){
   const e=Object.entries(v as Record<string,unknown>).sort(([a],[b])=>a.length-b.length||(a<b?-1:a>b?1:0));
   return"{"+e.map(([k,val])=>`"${k}": ${jsonbText(val)}`).join(", ")+"}";
  }
  if(typeof v==="string")return JSON.stringify(v);
  return String(v);
 }
 // La primera entrada de cada tenant encadena con el centinela 'GENESIS' (audit_chain_heads.last_hash por omisión), no con
 // NULL: previous_hash es NOT NULL desde 0013. Se comprueba explícitamente para que el encadenamiento sea verificable
 // desde el origen y no solo entre entradas consecutivas.
 let verificadas=0,previo:string|null="GENESIS";
 for(const f of filas as unknown as Record<string,unknown>[]){
  // Encadenamiento: el previous_hash de cada entrada es el entry_hash de la anterior.
  ok((f["previous_hash"]===null?null:String(f["previous_hash"]))===previo,`CHAIN_LINKED_AT_SEQ_${String(f["sequence"])}`);
  previo=String(f["entry_hash"]);
  if(digestEsperado(f)===String(f["entry_hash"]))verificadas++;
 }
 ok(verificadas===filas.length,`AUDIT_DIGEST_REPRODUCED_OUTSIDE_POSTGRES:${verificadas}/${filas.length}`);
 result.vector={algoritmo:"sha256(jsonb_build_object('tenant','sequence','id','previousHash','actor','action','resource','payload')::text)",
  entradas:filas.length,primeraSecuencia:Number((filas[0] as unknown as Record<string,unknown>)["sequence"]),
  nota:"Vector golden: el digest se reproduce FUERA de Postgres con la misma definición. Si la función SQL cambia, esta prueba falla."};

 // Una manipulación directa de la cadena rompe el encadenamiento (append-only a nivel de aplicación).
 let mutacionRechazada=false;
 try{await sql.begin(async tx=>{await tx`select set_config('app.tenant_id',${TENANT},true)`;await tx`update audit_chain_v3 set action='TAMPERED' where tenant_id=${TENANT}`;});}
 catch(e){mutacionRechazada=/APPEND_ONLY|permission|denied/i.test(String(e));}
 ok(mutacionRechazada,"AUDIT_CHAIN_IS_APPEND_ONLY");
}catch(e){result.status="FAIL";result.error=String(e);}
finally{await sql.end();}
fin();
