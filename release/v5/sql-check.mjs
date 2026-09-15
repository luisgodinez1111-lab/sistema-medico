
import fs from "node:fs";const files=["db/migrations/0001_core.sql","db/migrations/0002_clinical_domains.sql","db/policies/tenant_rls.sql"],errors=[];
for(const p of files){const s=fs.readFileSync(p,"utf8");if(!/tenant_id/i.test(s))errors.push(`TENANT_COLUMN_MISSING:${p}`);if(p.includes("migration")&&!/BEGIN;[\s\S]*COMMIT;/m.test(s))errors.push(`TRANSACTION_MISSING:${p}`);}
const rls=fs.readFileSync(files[2],"utf8");for(const t of ["patients","encounters","diagnostic_results","medications"])if(!rls.includes(`${t.split("_")[0]}`))errors.push(`RLS_REVIEW:${t}`);
console.log(JSON.stringify({status:errors.length?"FAIL":"PASS",files:files.length,errors},null,2));if(errors.length)process.exit(1);
