// EPIC BW — Evidencia física: MELD desde bilirrubina + INR + creatinina del paciente. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bw-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const resR=await import("../../apps/web/app/api/v1/results/route");
const md=await import("../../apps/web/app/api/v1/patients/[patientId]/meld/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["result:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000/* reloj RELATIVO: las calculadoras rechazan datos obsoletos; una fecha fija haría caducar la prueba */;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,occurredAt:at()})}));}
async function get(t:string,p:string){const r=await md.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) hepatopatía avanzada: bili 10, INR 2.5, creat 3.5 -> MELD alto, VERY_HIGH
 const p1=crypto.randomUUID();
 for(const[a,v]of[["BILIRUBIN","10"],["INR","2.5"],["CREATININE","3.5"]]as const)await res(phys,p1,a,v);
 let g=await get(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.meld>=35&&g.body.risk==="VERY_HIGH","VERY_HIGH_MELD");
 // 2) usa la bilirrubina MÁS RECIENTE: baja a 1.0 -> MELD baja
 const before=g.body.meld;await res(phys,p1,"BILIRUBIN","1.0");g=await get(phys,p1);ok(g.body.meld<before,"USES_LATEST_BILIRUBIN");
 // 3) valores normales -> MELD 6, LOW
 const p2=crypto.randomUUID();
 for(const[a,v]of[["BILIRUBIN","0.8"],["INR","1.0"],["CREATININE","0.9"]]as const)await res(phys,p2,a,v);
 g=await get(phys,p2);ok(g.body.meld===6&&g.body.risk==="LOW","NORMAL_MELD_6_LOW");
 // 4) falta un analito -> no computable
 const p3=crypto.randomUUID();await res(phys,p3,"BILIRUBIN","2");await res(phys,p3,"INR","1.5");
 g=await get(phys,p3);ok(g.body.computable===false&&g.body.missing.includes("CREATININE")&&/creatinina/i.test(g.body.reason),"MISSING_ANALYTE");
 // 5) sin scope patient:read -> 403
 const noScope=tok(["result:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
