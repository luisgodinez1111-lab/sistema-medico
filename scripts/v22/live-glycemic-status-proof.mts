// EPIC BP — Evidencia física: control glucémico (HbA1c -> eAG + clasificación) con marco distinto según
// diabetes activa (E11). Cross-vertical resultado↔problema. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bp-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const resR=await import("../../apps/web/app/api/v1/results/route");
const prob=await import("../../apps/web/app/api/v1/problems/route");
const gs=await import("../../apps/web/app/api/v1/patients/[patientId]/glycemic-status/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["result:write","problem:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000/* reloj RELATIVO: las calculadoras rechazan datos obsoletos; una fecha fija haría caducar la prueba */;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function a1c(t:string,p:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:"HBA1C",value:v,occurredAt:at()})}));}
async function diagnose(t:string,p:string,code:string){await prob.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code,occurredAt:at()})}));}
async function status(t:string,p:string){const r=await gs.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) NO diabético, HbA1c 6.5 -> marco TAMIZAJE -> DIABETES_RANGE (diagnóstico)
 const p1=crypto.randomUUID();await a1c(phys,p1,"6.5");
 let g=await status(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.knownDiabetic===false&&g.body.frame==="SCREENING"&&g.body.category==="DIABETES_RANGE","SCREENING_DIABETES_RANGE");
 ok(g.body.estimatedAvgGlucose>0,"HAS_EAG");
 // 2) diabético conocido (E11), MISMO HbA1c 6.5 -> marco DIABÉTICO -> CONTROLLED (en meta)
 const p2=crypto.randomUUID();await diagnose(phys,p2,"E11");await a1c(phys,p2,"6.5");
 g=await status(phys,p2);ok(g.body.knownDiabetic===true&&g.body.frame==="DIABETIC"&&g.body.category==="CONTROLLED","DIABETIC_CONTROLLED");
 // 3) diabético con HbA1c 9.0 -> POOR (mal control)
 const p3=crypto.randomUUID();await diagnose(phys,p3,"E11");await a1c(phys,p3,"9.0");
 g=await status(phys,p3);ok(g.body.category==="POOR","DIABETIC_POOR");
 // 4) usa la HbA1c MÁS RECIENTE: nueva 5.4 en el no diabético -> NORMAL
 await a1c(phys,p1,"5.4");g=await status(phys,p1);ok(g.body.category==="NORMAL","USES_LATEST_A1C");
 // 5) sin HbA1c -> no computable
 const p4=crypto.randomUUID();g=await status(phys,p4);ok(g.body.computable===false,"NO_A1C_NOT_COMPUTABLE");
 // 6) sin scope patient:read -> 403
 const noScope=tok(["result:write"]);g=await status(noScope,p2);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
