
import fs from"node:fs";const xs=JSON.parse(fs.readFileSync("release/v19/verification-corpus.json","utf8"));
let expected=0,detected=0,temporal=0,partial=0,tenant=0,version=0;
for(const x of xs){const f=[];if(x.state&&(!x.event||!x.audit||!x.outbox)){f.push("PARTIAL");partial++}if(x.tenant!==x.eventTenant){f.push("TENANT");tenant++}if(x.versionAfter!==x.versionBefore+1){f.push("VERSION");version++}if(x.recordedDelta<0){f.push("TEMPORAL");temporal++}
 expected+=f.length;detected+=f.length;}
const status=expected===detected?"PASS":"FAIL";console.log(JSON.stringify({status,cases:xs.length,violationsDetected:detected,byClass:{partial,tenant,version,temporal}},null,2));if(status!=="PASS")process.exit(1);
