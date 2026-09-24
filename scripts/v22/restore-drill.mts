// EPIC C — Restore / Disaster-Recovery drill. Reconstruye el esquema en una BD DESECHABLE
// (un branch de Neon) y verifica: esquema idéntico al vivo, RLS forzado, cadena de auditoría
// encadenada, y persistencia determinista de eventos (replay). Gate real: restoreErrors().
//
// SEGURIDAD: exige RESTORE_DATABASE_URL y REHÚSA correr si apunta al mismo host+db que
// DATABASE_URL (el drill aplica DDL y escribe: nunca contra la BD activa).
//
// Ejecuta (con un branch de Neon): RESTORE_DATABASE_URL=postgres://... \
//   pnpm exec tsx ./scripts/v22/restore-drill.mts
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
import{directEndpoint as direct}from"../../packages/pg-endpoint/src";
import{deterministicUuid}from"../../packages/canonical-json/src";
try{
 const envRaw=fs.readFileSync(path.resolve(".env.local"),"utf8");
 for(const line of envRaw.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}
}catch{/* env ya cargado */}

const SOURCE=process.env.DATABASE_URL;
const TARGET=process.env.RESTORE_DATABASE_URL;
if(!SOURCE){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
if(!TARGET){console.log(JSON.stringify({status:"NOT_RUN",reason:"RESTORE_DATABASE_URL_MISSING",hint:"Provee un branch de Neon desechable en RESTORE_DATABASE_URL"}));process.exit(3);}
const hostDb=(u:string)=>{try{const x=new URL(direct(u).replace(/^postgres(ql)?:/,"http:"));return x.host+x.pathname;}catch{return u;}};
if(hostDb(SOURCE)===hostDb(TARGET)){console.log(JSON.stringify({status:"REFUSED",reason:"RESTORE_TARGET_EQUALS_SOURCE",detail:"el drill es destructivo; usa un branch/DB desechable distinto"}));process.exit(2);}

const{default:postgres}=await import("postgres");
const{executeAtomicClinicalCommand}=await import("../../packages/atomic-clinical-transaction-v3/src");
const{canonicalize}=await import("../../packages/canonical-json/src");
const{restoreErrors}=await import("../../packages/restore-proof/src");

const RUNTIME_ROLE="medical_os_runtime";
// Auditoría 2026-09-19, anexo R06 (R06-17): la huella del esquema solo miraba `information_schema.columns`, así que un
// cambio en ENABLE/FORCE ROW LEVEL SECURITY, en una política o en un GRANT **no la cambiaba** — y el comentario de cabecera
// de este drill promete verificar «esquema idéntico al vivo, RLS forzado». Un restore que recuperara las tablas y las
// dejara sin política pasaba el drill: exactamente el desastre que el drill dice descartar. Ahora la huella incluye las
// tres cosas, y el drill comprueba además que ninguna tabla con RLS se quede sin política.
async function schemaFingerprint(url:string){
 const sql=postgres(direct(url),{max:1,prepare:false,onnotice:()=>{}});
 try{
  const cols=await sql`select table_schema,table_name,column_name,data_type from information_schema.columns where table_schema in ('public','app') order by table_schema,table_name,ordinal_position`;
  // RLS por tabla: habilitado Y forzado (que el dueño de la tabla también quede sujeto a la política).
  const rls=await sql`select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname`;
  // Políticas: nombre, comando y expresiones. Una política que cambia de USING cambia quién ve qué.
  const pol=await sql`select tablename,policyname,cmd,coalesce(qual,'')as qual,coalesce(with_check,'')as wc from pg_policies where schemaname='public' order by tablename,policyname`;
  // Privilegios por rol: un GRANT de más es una fuga; uno de menos, una caída.
  const grants=await sql`select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and grantee like 'medical_os%' order by table_name,grantee,privilege_type`;
  const norm=[
   cols.map(r=>`C ${r.table_schema}.${r.table_name}.${r.column_name}:${r.data_type}`).join("|"),
   rls.map(r=>`R ${r.relname}:${r.relrowsecurity}:${r.relforcerowsecurity}`).join("|"),
   pol.map(r=>`P ${r.tablename}.${r.policyname}:${r.cmd}:${r.qual}:${r.wc}`).join("|"),
   grants.map(r=>`G ${r.table_name}:${r.grantee}:${r.privilege_type}`).join("|"),
  ].join("||");
  return crypto.createHash("sha256").update(norm).digest("hex");
 }finally{await sql.end();}
}
/** R06-17: toda tabla con RLS tiene que tener al menos una política; con RLS y sin política la tabla queda inservible. */
async function rlsWithoutPolicy(url:string):Promise<string[]>{
 const sql=postgres(direct(url),{max:1,prepare:false,onnotice:()=>{}});
 try{
  const rows=await sql`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relrowsecurity
     and not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
   order by c.relname`;
  return rows.map(r=>String(r.relname));
 }finally{await sql.end();}
}

// Comandos deterministas para el replay (semilla fija => stream de eventos reproducible).
const REPLAY_TENANT=crypto.createHash("sha256").update("restore-drill-tenant").digest("hex").slice(0,8)+"-0000-4000-8000-000000000000";
const det=(seed:string):string=>deterministicUuid(seed); // R01-015: única derivación de UUID del repo
function seededCommand(i:number){
 const key=`restore-drill-cmd-${i}`;
 return{commandId:det(key+":command"),idempotencyKey:key,aggregateId:REPLAY_TENANT,aggregateType:"Encounter",expectedVersion:i,eventId:det(key+":event"),eventType:"ENCOUNTER_OPENED",payload:{kind:"OPENED",step:i},outboxId:det(key+":outbox"),topic:"encounter.opened",auditId:det(key+":audit"),correlationId:det(key+":corr"),occurredAt:"2026-01-01T00:00:00.000Z"};
}

const out:{status:string;proof?:unknown;errors?:string[];note?:string}={status:"PASS"};
try{
 // 1) Preparar el TARGET (como owner). En un branch de Neon (copia point-in-time = el propio
 //    mecanismo de restore) el esquema YA existe; solo aseguramos roles + GRANTs idempotentes.
 //    Si el target estuviera VACÍO, se reconstruye completo desde migraciones.
 const owner=postgres(direct(TARGET),{max:1,prepare:false,onnotice:()=>{}});
 let rebuiltFromMigrations=false;
 try{
  await owner.unsafe(fs.readFileSync("db/roles_v16.sql","utf8"));
  await owner.unsafe(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles g ON g.oid=m.member WHERE r.rolname='${RUNTIME_ROLE}' AND g.rolname=current_user) THEN EXECUTE 'GRANT ${RUNTIME_ROLE} TO '||quote_ident(current_user); END IF; END $$;`);
  const present=await owner`select to_regclass('public.clinical_events') as t`;
  if(present[0]!.t){
   // Esquema presente (branch copia): aplicar solo la migración de GRANTs (idempotente).
   await owner.unsafe(fs.readFileSync("db/migrations/0017_runtime_role_grants.sql","utf8"));
  }else{
   // Target vacío: reconstrucción completa desde migraciones en orden.
   const files=fs.readdirSync("db/migrations").filter(f=>/^\d+_.*\.sql$/.test(f)).sort();
   for(const f of files)await owner.unsafe(fs.readFileSync(path.join("db/migrations",f),"utf8"));
   rebuiltFromMigrations=true;
  }
 }finally{await owner.end();}

 // 2) schemaHash (restaurado) vs expectedSchemaHash (vivo).
 const schemaHash=await schemaFingerprint(TARGET);
 const expectedSchemaHash=await schemaFingerprint(SOURCE);

 // 3) Ejecutar el stream determinista + audit en el TARGET bajo el rol runtime.
 const rt=postgres(direct(TARGET),{max:4,prepare:false,onnotice:()=>{},connection:{options:`-c role=${RUNTIME_ROLE}`}});
 let auditValid=false,rlsPass=false,replayHash="",liveHash="";
 try{
  const ctx={tenantId:REPLAY_TENANT,actorId:det("restore-actor"),actorType:"SYSTEM" as const,purpose:"TREATMENT",requestId:det("restore-req")}; // simulacro de restauración: SISTEMA (auditoría S-06)
  for(let i=0;i<2;i++)await executeAtomicClinicalCommand(rt,ctx,seededCommand(i));
  // replayHash: canonicaliza el stream persistido (aggregate,sequence,payload).
  const ev=await rt.begin(async tx=>{
   await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;
   return tx`select aggregate_id,sequence,payload from clinical_events where tenant_id=${ctx.tenantId} order by sequence`;
  });
  replayHash=crypto.createHash("sha256").update(canonicalize(ev.map(e=>({a:e.aggregate_id,s:Number(e.sequence),p:e.payload})))).digest("hex");
  // liveHash: proyección esperada, derivada de las definiciones puras (sin BD).
  liveHash=crypto.createHash("sha256").update(canonicalize([0,1].map(i=>({a:REPLAY_TENANT,s:i+1,p:{step:i}})))).digest("hex");
  // auditValid: cadena encadenada (previous_hash del 2.º == entry_hash del 1.º).
  const chain=await rt.begin(async tx=>{
   await tx`select set_config('app.tenant_id',${ctx.tenantId},true)`;
   return tx`select sequence,previous_hash,entry_hash from audit_chain_v3 where tenant_id=${ctx.tenantId} order by sequence`;
  });
  auditValid=chain.length>=2&&chain[1]!.previous_hash===chain[0]!.entry_hash;
  // rlsPass: otro tenant no ve estos eventos.
  const other={...ctx,tenantId:det("other-tenant")};
  const leak=await rt.begin(async tx=>{
   await tx`select set_config('app.tenant_id',${other.tenantId},true),set_config('app.actor_id',${other.actorId},true),set_config('app.purpose',${other.purpose},true),set_config('app.request_id',${other.requestId},true)`;
   return tx`select count(*)::int n from clinical_events where aggregate_id=${REPLAY_TENANT}`;
  });
  rlsPass=Number(leak[0]!.n)===0;
 }finally{await rt.end();}

 // R06-17: además del aislamiento por tenant (rlsPass), ninguna tabla con RLS puede quedarse sin política tras el restore.
 const sinPolitica=await rlsWithoutPolicy(TARGET);
 const proof={schemaHash,expectedSchemaHash,auditValid,rlsPass,rlsTablesWithoutPolicy:sinPolitica,policiesComplete:sinPolitica.length===0,
  replayHash,liveHash,obligationsMatch:replayHash===liveHash};
 const errors=restoreErrors(proof);
 out.proof=proof;out.errors=errors;out.status=errors.length?"FAIL":"PASS";
 // Auditoría 2026-09-19, anexo R06 (R06-16): el rango de migraciones estaba escrito a mano en esta nota y se quedó
 // desalineado del código real (declaraba hasta la 17.ª cuando ya había más). La evidencia de un drill no puede ser una
 // cadena que alguien olvidó actualizar: se genera del disco.
 out.note=rebuiltFromMigrations?`target vacio: reconstruido desde migraciones ${rangoMigraciones()}`:"branch de Neon (copia point-in-time = restore): esquema presente, verificado";
}catch(e){out.status="FAIL";out.note=String(e);}
console.log(JSON.stringify(out,null,2));
process.exit(out.status==="PASS"?0:1);
