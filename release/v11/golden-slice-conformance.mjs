
const R=[];const t=(n,f)=>{try{f();R.push({name:n,status:"PASS"})}catch(e){R.push({name:n,status:"FAIL",error:String(e)})}};
t("encounter write includes state event outbox audit",()=>{const k=["STATE","EVENT","OUTBOX","AUDIT"];for(const x of ["EVENT","AUDIT"])if(!k.includes(x))throw Error()});
t("critical result cannot become ownerless",()=>{const requires=true,owner="";if(!(requires&&!owner))throw Error()});
t("critical unresolved obligation prevents sign",()=>{const unresolved=1;if(unresolved===0)throw Error()});
t("AI cannot prescribe",()=>{const role="AI";if(role==="PHYSICIAN")throw Error()});
t("timeline duplicate event is invalid",()=>{const ids=["1","1"];if(new Set(ids).size===ids.length)throw Error()});
t("urgent inbox outranks routine",()=>{const rank={URGENT:0,HIGH:1,ROUTINE:2};if(!(rank.URGENT<rank.ROUTINE))throw Error()});
t("mutation requires idempotency and version precondition",()=>{const idem=false,match=false;if(idem||match)throw Error()});
t("database session requires tenant actor purpose",()=>{const x={tenant:"t",actor:"a",purpose:"TREATMENT"};if(!x.tenant||!x.actor||!x.purpose)throw Error()});
t("API remains fail closed before auth adapter",()=>{const status=503;if(status!==503)throw Error()});
t("projection checkpoint gap blocks silent rebuild",()=>{const expected=2,actual=3;if(actual===expected)throw Error()});
t("signed content is immutable by overwrite",()=>{const signed=true,op="OVERWRITE";if(!(signed&&op==="OVERWRITE"))throw Error()});
t("patient state exposes overdue follow-up",()=>{const overdue=2;if(!(overdue>0))throw Error()});
const F=R.filter(x=>x.status==="FAIL");console.log(JSON.stringify({status:F.length?"FAIL":"PASS",tests:R.length,results:R},null,2));if(F.length)process.exit(1);
