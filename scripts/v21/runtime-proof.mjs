
import{spawnSync}from"node:child_process";import fs from"node:fs";import crypto from"node:crypto";
const cmds=[["node",["scripts/v21/live-postgres-proof.mjs"]],["node",["scripts/v21/live-rls-proof.mjs"]]];
const results=[];for(const[c,a]of cmds){const r=spawnSync(c,a,{encoding:"utf8",env:process.env});results.push({command:[c,...a].join(" "),exitCode:r.status,stdoutHash:crypto.createHash("sha256").update(r.stdout||"").digest("hex"),stderrHash:crypto.createHash("sha256").update(r.stderr||"").digest("hex"),stdout:r.stdout,stderr:r.stderr})}
const state=results.every(x=>x.exitCode===0)?"EXECUTED_RUNTIME_PASS":results.some(x=>x.exitCode===3)?"NOT_RUN":"EXECUTED_RUNTIME_FAIL";
fs.writeFileSync("release/v21/runtime-proof-evidence.json",JSON.stringify({state,results},null,2));console.log(JSON.stringify({state,commands:results.length},null,2));process.exit(state==="EXECUTED_RUNTIME_FAIL"?1:0);
