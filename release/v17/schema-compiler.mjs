import fs from "node:fs";import path from "node:path";
const dir="db/migrations",files=fs.readdirSync(dir).filter(x=>x.endsWith(".sql")).sort(),tables=new Map(),issues=[];
for(const f of files){
 const s=fs.readFileSync(path.join(dir,f),"utf8");
 for(const m of s.matchAll(/CREATE TABLE IF NOT EXISTS\s+([\w.]+)\s*\(([^;]+?)\);/gis)){
  const name=m[1],cols=[...m[2].matchAll(/(?:^|,)\s*([a-z_][\w]*)\s+(?:uuid|text|bigint|integer|jsonb|timestamptz|date|boolean)/gim)].map(x=>x[1]);
  if(tables.has(name)){const prior=tables.get(name);if(JSON.stringify(prior.cols)!==JSON.stringify(cols))issues.push({severity:"S2",code:"TABLE_REDECLARATION_DRIFT",table:name,first:prior.file,again:f});}
  else tables.set(name,{file:f,cols});
 }
}
console.log(JSON.stringify({status:issues.length?"WARN":"PASS",tables:tables.size,issues},null,2));
