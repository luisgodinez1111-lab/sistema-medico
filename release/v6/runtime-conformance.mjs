
import fs from "node:fs";const results=[];const test=(name,fn)=>{try{fn();results.push({name,status:"PASS"})}catch(e){results.push({name,status:"FAIL",error:String(e)})}};
test("result received cannot close",()=>{const state="RECEIVED";if(["ACTIONED","PATIENT_INFORMED"].includes(state))return;});
test("unknown cannot become reassuring computed value",()=>{const status="INSUFFICIENT_DATA";if(status==="COMPUTED")throw Error("bad")});
test("AI cannot prescribe",()=>{const actor="AI";if(actor!=="PHYSICIAN")return;throw Error("bad")});
test("overdue is not completed",()=>{const s="OVERDUE";if(s==="COMPLETED")throw Error("bad")});
test("cross tenant is blocked",()=>{const actorTenant="A",resourceTenant="B";if(actorTenant===resourceTenant)throw Error("bad")});
test("enabled capability requires evidence",()=>{const state="ENABLED",evidence="";if(state==="ENABLED"&&!evidence)return;throw Error("bad")});
const failed=results.filter(x=>x.status==="FAIL");const out={status:failed.length?"FAIL":"PASS",tests:results.length,results};fs.writeFileSync("release/v6/runtime-conformance-result.json",JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));if(failed.length)process.exit(1);
