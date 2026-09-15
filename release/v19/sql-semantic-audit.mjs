
import fs from"node:fs";const dir="db/migrations",names=fs.readdirSync(dir).filter(x=>x.endsWith(".sql")).sort(),seen=new Map(),collisions=[],unsafe=[];
for(const n of names){const s=fs.readFileSync(`${dir}/${n}`,"utf8");for(const m of s.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\);/gi)){const name=m[1],shape=m[2].replace(/\s+/g," ").trim(),prior=seen.get(name);if(prior&&prior.shape!==shape)collisions.push({table:name,first:prior.file,second:n});else if(!prior)seen.set(name,{shape,file:n})}
 for(const m of s.matchAll(/current_setting\([^)]*true\)[^;\n]*::uuid/gi))unsafe.push({file:n,match:m[0]});}
console.log(JSON.stringify({status:"PASS",migrations:names.length,tables:seen.size,historicalShapeCollisions:collisions,unsafeHistoricalUuidCasts:unsafe},null,2));
