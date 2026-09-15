
import fs from"node:fs";const findings=[],read=p=>fs.readFileSync(p,"utf8");
const pkg=JSON.parse(read("package.json"));
for(const [name,v] of Object.entries({...pkg.dependencies,...pkg.devDependencies})){if(typeof v==="string"&&(/^[~^*]|latest|workspace:\*/.test(v)))findings.push(["S2","UNPINNED_DEPENDENCY",name+":"+v]);}
const env=read(".env.example");if(/SECRET=.{8,}\n/.test(env)&&!env.includes("replace"))findings.push(["S1","SECRET_IN_ENV_EXAMPLE","Possible committed secret"]);
const logger=read("packages/secure-logger/src/index.ts");if(!logger.includes("REDACTED_DEPTH"))findings.push(["S2","LOGGER_DEPTH","Recursive logger lacks depth cap"]);
const numeric=read("packages/clinical-numeric/src/index.ts");if(!numeric.includes("Number.isFinite"))findings.push(["S1","NON_FINITE_NUMERIC","NaN/Infinity accepted"]);
const policy=read("packages/policy-conflict-v2/src/index.ts");if(!policy.includes("POLICY_CONFLICT"))findings.push(["S1","POLICY_TIE","Conflicting equal priority policies not blocked"]);
const migration=read("db/migrations/0014_adversarial_verification.sql");if(!migration.includes("fencing_token"))findings.push(["S1","OUTBOX_FENCE","No persistent fencing token"]);
const unresolved=findings.filter(x=>x[0]==="S1");console.log(JSON.stringify({status:unresolved.length?"FAIL":"PASS",findings,unresolvedCritical:unresolved.length},null,2));if(unresolved.length)process.exit(1);
