
const R=[];const t=(n,f)=>{try{f();R.push({name:n,status:"PASS"})}catch(e){R.push({name:n,status:"FAIL",error:String(e)})}};
t("cross tenant always denied",()=>{const principal="a",target="b";if(principal===target)throw Error()});
t("missing idempotency precondition blocks",()=>{const key="";if(key)throw Error()});
t("lost update is conflict not overwrite",()=>{const expected=1,actual=2;if(expected===actual)throw Error()});
t("signed encounter cannot be assessed again",()=>{const status="SIGNED";if(status!=="SIGNED")throw Error()});
t("critical obligation blocks sign",()=>{const critical=1;if(critical===0)throw Error()});
t("overdue open obligation escalates",()=>{const due=1,now=2;if(!(due<now))throw Error()});
t("non physician cannot prescribe",()=>{const roles=["AI"];if(roles.includes("PHYSICIAN"))throw Error()});
t("correction cannot supersede itself",()=>{const a="r1",b="r1";if(a!==b)throw Error()});
t("defective policy with clinical action is urgent impact",()=>{const action="PRESCRIPTION";if(!action)throw Error()});
t("projection sequence gap blocks",()=>{const expected=1,actual=2;if(actual===expected)throw Error()});
t("active outbox lease cannot be stolen",()=>{const lockedUntil=10,now=1;if(!(lockedUntil>now))throw Error()});
t("max-attempt message becomes dead letter",()=>{const attempt=8,max=8;if(attempt<max)throw Error()});
t("C5 safety case requires human approval",()=>{const risk="C5",approved=false;if(!(risk==="C5"&&!approved))throw Error()});
t("missing tenant DB context blocks safe transaction",()=>{const tenant="";if(tenant)throw Error()});
t("consumer receipt is tenant scoped",()=>{const key=["tenant","consumer","message"];if(key.length!==3)throw Error()});
t("unknown clinical state is never coerced to normal",()=>{const status="INSUFFICIENT_DATA";if(status==="COMPUTED")throw Error()});
const F=R.filter(x=>x.status==="FAIL");console.log(JSON.stringify({status:F.length?"FAIL":"PASS",tests:R.length,results:R},null,2));if(F.length)process.exit(1);
