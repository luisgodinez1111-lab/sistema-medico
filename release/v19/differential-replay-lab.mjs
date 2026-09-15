
import crypto from"node:crypto";const canon=x=>x===null||typeof x!=="object"?JSON.stringify(x):Array.isArray(x)?`[${x.map(canon).join(",")}]`:`{${Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canon(x[k])).join(",")}}`;const h=x=>crypto.createHash("sha256").update(canon(x)).digest("hex");
let seed=19,fail=0;const next=()=>seed=(1664525*seed+1013904223)>>>0;
for(let run=0;run<10000;run++){const events=[];let live={sum:0,count:0,last:0};const n=5+(next()%50);for(let i=1;i<=n;i++){const v=(next()%200)-100;events.push({seq:i,v});live={sum:live.sum+v,count:live.count+1,last:i}}let replay={sum:0,count:0,last:0};for(const e of events){if(e.seq!==replay.last+1)throw Error("GAP");replay={sum:replay.sum+e.v,count:replay.count+1,last:e.seq}}if(h(live)!==h(replay))fail++;}
console.log(JSON.stringify({status:fail?"FAIL":"PASS",runs:10000,mismatches:fail},null,2));if(fail)process.exit(1);
