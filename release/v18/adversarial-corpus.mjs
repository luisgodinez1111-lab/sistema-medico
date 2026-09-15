
import fs from"node:fs";const xs=JSON.parse(fs.readFileSync("release/v18/property-corpus.json","utf8"));let partial=0,tenant=0,version=0,missed=0;
for(const x of xs){const f=[];if(x.state&&(!x.event||!x.audit||!x.outbox))f.push("PARTIAL_TRUTH");if(x.tenant!==x.eventTenant)f.push("CROSS_TENANT_EVENT");if(x.versionAfter!==x.versionBefore+1)f.push("VERSION_STEP");
if(f.includes("PARTIAL_TRUTH"))partial++;if(f.includes("CROSS_TENANT_EVENT"))tenant++;if(f.includes("VERSION_STEP"))version++;
if(x.state&&(!x.event||!x.audit||!x.outbox)&&!f.includes("PARTIAL_TRUTH"))missed++;if(x.tenant!==x.eventTenant&&!f.includes("CROSS_TENANT_EVENT"))missed++;if(x.versionAfter!==x.versionBefore+1&&!f.includes("VERSION_STEP"))missed++;}
console.log(JSON.stringify({status:missed?"FAIL":"PASS",cases:xs.length,detected:{partialTruth:partial,crossTenant:tenant,version:version},missed},null,2));if(missed)process.exit(1);
