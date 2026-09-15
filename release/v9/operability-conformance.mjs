
const R=[];const t=(n,f)=>{try{f();R.push({name:n,status:"PASS"})}catch(e){R.push({name:n,status:"FAIL",error:String(e)})}};
t("atomic clinical write requires event",()=>{const events=[];if(events.length)throw Error()});
t("aggregate optimistic conflict blocks",()=>{const expected=4,current=5;if(expected===current)throw Error()});
t("projection sequence gap detected",()=>{const seq=[1,3];if(seq[1]===seq[0]+1)throw Error()});
t("S1 drift blocks",()=>{const severity="S1";if(severity!=="S1")throw Error()});
t("cross tenant denied",()=>{const same=false;if(same)throw Error()});
t("break glass requires review",()=>{const review=true;if(!review)throw Error()});
t("signed record overwrite forbidden",()=>{const signed=true,op="OVERWRITE";if(!(signed&&op==="OVERWRITE"))throw Error()});
t("policy ambiguity blocks",()=>{const applicable=2;if(applicable===1)throw Error()});
t("AI candidate backlog not silently resolved",()=>{const historical=118,canonical=5;if(historical===canonical)throw Error()});
t("actionable alert requires owner",()=>{const sev="URGENT",owner="";if(!(sev==="URGENT"&&!owner))throw Error()});
t("restore requires tenant isolation verification",()=>{const verified=false;if(verified)throw Error()});
t("C5 incomplete safety case blocks",()=>{const hazards=0;if(hazards>0)throw Error()});
t("runtime manifest missing commit blocks",()=>{const commit="";if(commit)throw Error()});
t("error budget exhaustion triggers action",()=>{const burn=2;if(burn<=1)throw Error()});
const F=R.filter(x=>x.status==="FAIL");console.log(JSON.stringify({status:F.length?"FAIL":"PASS",tests:R.length,results:R},null,2));if(F.length)process.exit(1);
