
import fs from"node:fs";import path from"node:path";
const files=[];function walk(d){for(const n of fs.readdirSync(d)){if(["node_modules",".git"].includes(n))continue;const p=path.join(d,n),s=fs.statSync(p);s.isDirectory()?walk(p):files.push(p)}}walk(".");
const findings=[];
for(const p of files.filter(x=>/\.(ts|tsx|mjs|sql)$/.test(x))){const s=fs.readFileSync(p,"utf8");
 if(/\bTODO\b|\bFIXME\b|\bHACK\b/.test(s))findings.push(["S3","MARKER",p]);
 if(/Math\.random\(\)/.test(s)&&/packages|apps/.test(p))findings.push(["S2","NONDETERMINISTIC_RANDOM",p]);
 if(/console\.log\(/.test(s)&&/apps|packages/.test(p)&&!p.includes("logger"))findings.push(["S3","DIRECT_CONSOLE",p]);
 if(/new Date\(\)/.test(s)&&/composer|calculation|replay|fingerprint/.test(p))findings.push(["S2","WALL_CLOCK_DETERMINISM",p]);
 if(/sql\.unsafe/.test(s)&&!p.includes("release/v16/deep-bug-audit.mjs")&&!p.includes("release/v17/deep-bug-audit.mjs")&&!p.includes("release/v19/repository-audit.mjs"))findings.push(["S1","SQL_UNSAFE",p]);
 if(/catch\s*\([^)]*\)\s*\{\s*\}/.test(s))findings.push(["S2","EMPTY_CATCH",p]);
 if(/as any/.test(s)&&/packages\/(clinical|atomic|result|medication|obligation)/.test(p))findings.push(["S2","ANY_IN_CLINICAL_CORE",p]);
}
const s1=findings.filter(x=>x[0]==="S1"),s2=findings.filter(x=>x[0]==="S2");
console.log(JSON.stringify({status:s1.length?"FAIL":"PASS",filesScanned:files.length,findings,s1:s1.length,s2:s2.length},null,2));if(s1.length)process.exit(1);
