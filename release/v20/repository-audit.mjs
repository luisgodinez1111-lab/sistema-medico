
import fs from"node:fs";import path from"node:path";const files=[];function walk(d){for(const n of fs.readdirSync(d)){if(["node_modules",".git","docs"].includes(n))continue;const p=path.join(d,n),s=fs.statSync(p);s.isDirectory()?walk(p):files.push(p)}}walk(".");
const f=[];for(const p of files.filter(x=>/\.(ts|tsx|mjs|sql)$/.test(x))){if(p.includes("release/v16/")||p.includes("release/v17/")||p.includes("release/v19/"))continue;const s=fs.readFileSync(p,"utf8");
if(/sql\.unsafe/.test(s))f.push(["S1","SQL_UNSAFE",p]);if(/catch\s*\([^)]*\)\s*\{\s*\}/.test(s))f.push(["S2","EMPTY_CATCH",p]);if(/\bTODO\b|\bFIXME\b|\bHACK\b/.test(s))f.push(["S3","MARKER",p]);
if(/new Date\(\)/.test(s)&&/replay|fingerprint|calculation|composer/.test(p))f.push(["S2","WALL_CLOCK_DETERMINISM",p]);}
const s1=f.filter(x=>x[0]==="S1"),s2=f.filter(x=>x[0]==="S2");console.log(JSON.stringify({status:s1.length?"FAIL":"PASS",filesScanned:files.length,findings:f,s1:s1.length,s2:s2.length},null,2));if(s1.length)process.exit(1);
