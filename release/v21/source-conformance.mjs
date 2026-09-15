
import fs from"node:fs";const checks=[];
const add=(n,v)=>{if(!v)throw Error(n);checks.push(n)};
const mig=fs.readFileSync("db/migrations/0016_runtime_execution_hardening.sql","utf8");
add("runtime role NOBYPASSRLS",mig.includes("medical_os_runtime LOGIN NOBYPASSRLS"));
add("worker role NOBYPASSRLS",mig.includes("medical_os_worker LOGIN NOBYPASSRLS"));
add("readonly role NOBYPASSRLS",mig.includes("medical_os_readonly LOGIN NOBYPASSRLS"));
add("clinical events FORCE RLS",mig.includes("ALTER TABLE clinical_events FORCE ROW LEVEL SECURITY"));
add("outbox FORCE RLS",mig.includes("ALTER TABLE outbox FORCE ROW LEVEL SECURITY"));
add("idempotency FORCE RLS",mig.includes("ALTER TABLE command_idempotency FORCE ROW LEVEL SECURITY"));
add("live postgres harness exists",fs.existsSync("scripts/v21/live-postgres-proof.mjs"));
add("live rls harness exists",fs.existsSync("scripts/v21/live-rls-proof.mjs"));
add("runtime proof evidence wrapper exists",fs.existsSync("scripts/v21/runtime-proof.mjs"));
console.log(JSON.stringify({status:"PASS",checks:checks.length,results:checks},null,2));
