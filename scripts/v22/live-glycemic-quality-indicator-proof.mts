// Hallazgo D10 del lote 11 — Evidencia física: el indicador de calidad «HbA1c en control» del tablero usa el valor CANÓNICO
// en % (el mismo que la evaluación glucémica por paciente) y excluye los resultados reemplazados por una corrección. Antes
// parseaba el texto recibido («6,5» -> 65; 48 mmol/mol IFCC -> 48 %) y contaba el original corregido: 4 pacientes
// diabéticos en meta aparecían como 25 % en control. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET; // R11-07: el prólogo (_live-env) fija un secreto aleatorio por corrida
const{signSession}=await import("../../packages/session/src");
const resR=await import("../../apps/web/app/api/v1/results/route");
const corrR=await import("../../apps/web/app/api/v1/results/[resultId]/correction/route");
const prob=await import("../../apps/web/app/api/v1/problems/route");
const gs=await import("../../apps/web/app/api/v1/patients/[patientId]/glycemic-status/route");
const repR=await import("../../apps/web/app/api/v1/reports/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const tok=()=>signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes:["result:write","result:read","problem:write","patient:read","record:export"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
type QI={key:string;numerator:number;denominator:number;pct:number;computable:boolean};
try{
 const phys=tok();
 async function receive(p:string,value:string,unit?:string){const resultId=crypto.randomUUID();
  const r=await resR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({resultId,patientId:p,orderId:crypto.randomUUID(),analyte:"HBA1C",value,...(unit?{unit}:{}),occurredAt:at()})}));
  if(r.status!==201)throw new Error(`RECEIVE_${value}_${r.status}`);return resultId;}
 const qi=async()=>((await(await repR.GET(new Request("http://l/",{headers:H(phys)}))).json()).qualityIndicators as QI[]).find(q=>q.key==="glycemic_control")!;
 const category=async(p:string)=>(await(await gs.GET(new Request("http://l/",{headers:H(phys)}),{params:Promise.resolve({patientId:p})})).json()).category as string;
 // Cuatro diabéticos EN META capturados en formatos distintos; el cuarto con un resultado corregido (9.0 % -> 6.3 %).
 const pts:string[]=[];let toCorrect="";
 for(const[value,unit]of[["6,5","%"],["48","mmol/mol"],["6,8","%"],["9.0","%"]]as const){ // main exige `unit` al recibir (R02a-RES-01)
  const p=crypto.randomUUID();await ensurePatientIn(TA,p);pts.push(p);
  const d=await prob.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code:"E11.9",occurredAt:at()})}));
  if(d.status!==201)throw new Error(`PROBLEM_${d.status}`);
  const id=await receive(p,value,unit);if(value==="9.0")toCorrect=id;
 }
 const c=await corrR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({correctedResultId:crypto.randomUUID(),value:"6.3",unit:"%",reason:"Corrección del laboratorio",occurredAt:at()})}),{params:Promise.resolve({resultId:toCorrect})});
 ok(c.status===201,"RESULT_CORRECTED_9_0_TO_6_3");
 const cats=await Promise.all(pts.map(category));ok(cats.every(x=>x==="CONTROLLED"),"EACH_PATIENT_CONTROLLED_BY_GLYCEMIC_STATUS");
 const q=await qi();
 ok(q.computable&&q.denominator===4,"SUPERSEDED_RESULT_NOT_COUNTED");
 ok(q.numerator===4&&q.pct===100,"DASHBOARD_MATCHES_PER_PATIENT_ASSESSMENT");
 const reg=(await(await resR.GET(new Request("http://l/",{headers:H(phys)}))).json()).items as{value:string}[];
 ok(reg.some(i=>i.value==="6,5")&&reg.some(i=>i.value==="48"),"REGISTRY_KEEPS_VALUE_AS_RECEIVED");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
