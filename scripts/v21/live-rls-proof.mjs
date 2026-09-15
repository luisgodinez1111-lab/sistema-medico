
const url=process.env.TEST_DATABASE_URL;if(!url){console.log(JSON.stringify({status:"NOT_RUN",reason:"TEST_DATABASE_URL_MISSING"}));process.exit(3)};
const {default:postgres}=await import("postgres")
const sql=postgres(url,{max:2});let out={status:"PASS",checks:[]};
try{
 const policies=await sql`select tablename,policyname from pg_policies where schemaname='public'`;if(!policies.length)throw Error("NO_RLS_POLICIES");out.checks.push("POLICIES_PRESENT");
 const forced=await sql`select relname,relforcerowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relname in ('clinical_events','outbox','command_idempotency')`;
 if(forced.some(x=>!x.relforcerowsecurity))throw Error("FORCE_RLS_MISSING");out.checks.push("FORCE_RLS");
}catch(e){out={status:"FAIL",error:String(e),checks:out.checks}}finally{await sql.end()}console.log(JSON.stringify(out,null,2));process.exit(out.status==="PASS"?0:1);
