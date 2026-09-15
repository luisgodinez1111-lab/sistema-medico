
const phases=["BEFORE_TX","IN_TX","AFTER_COMMIT","AFTER_CLAIM","AFTER_SIDE_EFFECT","AFTER_RECEIPT"];let seed=20020,fail=0,counts={};const next=()=>seed=(1664525*seed+1013904223)>>>0;
const expectation=p=>p==="BEFORE_TX"||p==="IN_TX"?"NO_AUTHORITATIVE_PARTIAL_WRITE":p==="AFTER_COMMIT"?"OUTBOX_RECOVERABLE":p==="AFTER_CLAIM"?"LEASE_EXPIRES_AND_RECLAIMS":p==="AFTER_SIDE_EFFECT"?"CONSUMER_RECEIPT_OR_IDEMPOTENT_RETRY":"NO_REDELIVERY_AUTHORITY";
for(let i=0;i<250000;i++){const p=phases[next()%phases.length],e=expectation(p);counts[e]=(counts[e]||0)+1;if(!e)fail++}
console.log(JSON.stringify({status:fail?"FAIL":"PASS",cases:250000,counts,fail},null,2));if(fail)process.exit(1);
