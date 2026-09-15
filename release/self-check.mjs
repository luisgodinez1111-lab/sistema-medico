import fs from "node:fs"; import crypto from "node:crypto";
const must=["safety/invariants.json","safety/hazards.json","state-machines/formal/SM-FORMAL-RESULT-001.json","state-machines/formal/SM-FORMAL-OBLIGATION-001.json","state-machines/formal/SM-FORMAL-MED-001.json","state-machines/formal/SM-FORMAL-TRUTH-001.json","ai-tasks/catalog.json","ai-tasks/bindings.json","ai-tasks/evals.json","safety-envelopes/catalog.json"];
const errors=[]; for(const p of must){if(!fs.existsSync(p))errors.push(`MISSING:${p}`);}
const tasks=JSON.parse(fs.readFileSync("ai-tasks/catalog.json")); const binds=JSON.parse(fs.readFileSync("ai-tasks/bindings.json")); const env=JSON.parse(fs.readFileSync("safety-envelopes/catalog.json")); const evals=JSON.parse(fs.readFileSync("ai-tasks/evals.json"));
const bm=new Map(binds.map(x=>[x.ai_task,x.safety_envelope])), ei=new Set(env.map(x=>x.id)), vi=new Set(evals.map(x=>x.id));
for(const t of tasks){if(!t.authority?.length)errors.push(`NO_AUTHORITY:${t.id}`);if(["C4","C5"].includes(t.risk)&&(!bm.get(t.id)||!ei.has(bm.get(t.id))||!vi.has(t.evalSuite)||t.killSwitch!==true))errors.push(`AI_SAFETY_GAP:${t.id}`);}
const manifest=JSON.parse(fs.readFileSync("release/test-evidence-manifest.json"));
for(const x of manifest){if(!fs.existsSync(x.test)){errors.push(`MISSING_TEST:${x.test}`);continue;}const h=crypto.createHash("sha256").update(fs.readFileSync(x.test)).digest("hex");if(h!==x.sha256)errors.push(`HASH_MISMATCH:${x.test}`);if(!x.authority?.length)errors.push(`UNBOUND_TEST:${x.test}`);}
console.log(JSON.stringify({status:errors.length?"FAIL":"PASS",checks:{requiredArtifacts:must.length,aiTasks:tasks.length,testSources:manifest.length},errors},null,2)); if(errors.length)process.exit(1);
