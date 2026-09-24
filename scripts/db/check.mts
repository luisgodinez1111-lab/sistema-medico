// `pnpm db:check` — comprobaciones REALES del esquema (auditoría D-06/D-08). Sustituye a release/v5/sql-check.mjs, que solo
// buscaba la palabra "tenant_id" en tres ficheros.
//  1) sin base: el manifiesto de migraciones coincide con los ficheros (deriva en el repo).
//  2) con DATABASE_URL: ninguna tabla con RLS carece de política (denegación total), ninguna tabla con tenant_id carece de
//     RLS+FORCE, y la tabla de control no registra deriva ni migraciones pendientes.
import fs from"node:fs";import path from"node:path";
import{directEndpoint as direct}from"../../packages/pg-endpoint/src";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{/* sin .env.local */}
const{readMigrationFiles,manifestDrift}=await import("../../packages/db-migrations/src");
const out:{status:"PASS"|"FAIL";checks:Record<string,unknown>}={status:"PASS",checks:{}};
const fail=(k:string,v:unknown)=>{out.status="FAIL";out.checks[k]=v;};
const files=readMigrationFiles();
const drift=manifestDrift(JSON.parse(fs.readFileSync("db/migrations/manifest.json","utf8")),files);
if(drift.missing.length||drift.changed.length||drift.extra.length)fail("manifest",drift);else out.checks["manifest"]=`ok (${files.length} migraciones)`;
if(process.env.DATABASE_URL){
 const{default:postgres}=await import("postgres");
 const sql=postgres(direct(process.env.DATABASE_URL),{max:1,prepare:false,onnotice:()=>{}});
 try{
  const noPolicy=await sql`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and not exists(select 1 from pg_policy p where p.polrelid=c.oid) order by 1`;
  const noRls=await sql`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not(c.relrowsecurity and c.relforcerowsecurity) and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='tenant_id' and not a.attisdropped) order by 1`;
  const nP=noPolicy.map(r=>String(r.relname)),nR=noRls.map(r=>String(r.relname));
  if(nP.length)fail("rls_without_policy",nP);else out.checks["rls_without_policy"]="ok";
  if(nR.length)fail("tenant_tables_without_forced_rls",nR);else out.checks["tenant_tables_without_forced_rls"]="ok";
  const ctl=await sql`select to_regclass('public.schema_migrations') as t`;
  if(!ctl[0]?.t)fail("schema_migrations","tabla de control ausente: ejecute pnpm db:migrate -- baseline/up");
  else{
   const applied=await sql`select version,sha256 from schema_migrations` as unknown as{version:string;sha256:string}[];
   const byV=new Map(applied.map(a=>[a.version,a.sha256]));
   const dDrift=files.filter(f=>byV.has(f.version)&&byV.get(f.version)!==f.sha256).map(f=>f.filename);
   const pending=files.filter(f=>!byV.has(f.version)).map(f=>f.filename);
   if(dDrift.length)fail("db_drift",dDrift);else out.checks["db_drift"]="ok";
   if(pending.length)fail("db_pending",pending);else out.checks["db_pending"]="ok";
  }
 }finally{await sql.end();}
}else out.checks["database"]="sin DATABASE_URL: solo comprobaciones del repo";
console.log(JSON.stringify(out,null,2));process.exit(out.status==="PASS"?0:1);
