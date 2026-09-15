
import fs from"node:fs";import crypto from"node:crypto";
const url=process.env.TEST_DATABASE_URL;if(!url){console.log(JSON.stringify({status:"NOT_RUN",reason:"TEST_DATABASE_URL_MISSING"}));process.exit(3)};
const {default:postgres}=await import("postgres")
const sql=postgres(url,{max:5});const result={status:"PASS",checks:[]};
try{
 const v=await sql`select version() as version`;result.postgres=v[0].version;
 const tables=await sql`select table_name,column_name from information_schema.columns where table_schema='public'`;
 const map={};for(const r of tables)(map[r.table_name]??=[]).push(r.column_name);
 for(const [t,cols] of Object.entries({aggregate_versions:["tenant_id","aggregate_id","version"],clinical_events:["tenant_id","aggregate_id","sequence"],outbox:["tenant_id","id","state"],command_idempotency:["tenant_id","actor_id","idempotency_key"]})){
  if(!map[t])throw Error("MISSING_TABLE:"+t);for(const c of cols)if(!map[t].includes(c))throw Error("MISSING_COLUMN:"+t+"."+c);result.checks.push("SCHEMA:"+t)
 }
 const roles=await sql`select rolname,rolsuper,rolbypassrls from pg_roles where rolname in ('medical_os_runtime','medical_os_worker','medical_os_readonly')`;
 for(const r of roles)if(r.rolsuper||r.rolbypassrls)throw Error("RLS_BYPASS:"+r.rolname);result.checks.push("ROLE_MODEL");
}catch(e){result.status="FAIL";result.error=String(e)}finally{await sql.end()}
const text=JSON.stringify(result,null,2);fs.writeFileSync("release/v21/live-postgres-result.json",text);console.log(text);process.exit(result.status==="PASS"?0:1);
