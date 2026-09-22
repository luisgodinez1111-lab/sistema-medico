// EPIC BB — Evidencia física del delta check longitudinal: un resultado nuevo cuya variación vs el valor
// PREVIO del mismo analito es crítica se ELEVA a `critical` aunque el valor absoluto no sea de pánico. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bb-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const results=await import("../../apps/web/app/api/v1/results/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes:["result:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
// t: minutos crecientes para que occurred_at ordene los resultados cronológicamente.
let seq=0;const at=()=>new Date(Date.parse("2026-09-14T08:00:00.000Z")+(seq++)*60000).toISOString();
async function receive(t:string,pat:string,analyte:string,value:string){const id=crypto.randomUUID();const r=await results.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:id,patientId:pat,orderId:crypto.randomUUID(),analyte,value,occurredAt:at()})}));return r;}
try{
 const phys=tok();
 // 1) creatinina previa normal 0.9; nueva 1.9 (dentro de "alto" pero no pánico absoluto <4) -> delta crítico eleva a critical
 const p1=crypto.randomUUID();
 let r=await receive(phys,p1,"CREATININE","0.9");let j=await r.json();ok(r.status===201&&j.critical===false&&j.deltaFlagged===false,"CREAT_BASELINE_NOT_CRITICAL");
 r=await receive(phys,p1,"CREATININE","1.9");j=await r.json();ok(r.status===201&&j.critical===true&&j.deltaFlagged===true,"CREAT_DOUBLING_DELTA_CRITICAL");
 // 2) hemoglobina 12 -> 9.5 (caída 2.5, dentro de rango "bajo" no pánico >=7) -> delta crítico
 const p2=crypto.randomUUID();
 await receive(phys,p2,"HEMOGLOBIN","12");
 r=await receive(phys,p2,"HEMOGLOBIN","9.5");j=await r.json();ok(j.critical===true&&j.deltaFlagged===true,"HGB_DROP_DELTA_CRITICAL");
 // 3) creatinina 0.9 -> 1.1 (subida leve) -> NO delta, no critical
 const p3=crypto.randomUUID();
 await receive(phys,p3,"CREATININE","0.9");
 r=await receive(phys,p3,"CREATININE","1.1");j=await r.json();ok(j.critical===false&&j.deltaFlagged===false,"CREAT_STABLE_NO_DELTA");
 // 4) primer resultado sin previo -> no delta (aunque el valor sea 'alto' no de pánico)
 const p4=crypto.randomUUID();
 r=await receive(phys,p4,"CREATININE","1.9");j=await r.json();ok(j.deltaFlagged===false,"NO_PRIOR_NO_DELTA");
 // 5) aislamiento por paciente: el previo de OTRO paciente no cuenta como baseline
 const p5=crypto.randomUUID();
 r=await receive(phys,p5,"CREATININE","1.9");j=await r.json();ok(j.deltaFlagged===false,"PER_PATIENT_ISOLATION");
 // 6) valor absoluto de pánico sigue siendo crítico por classifyLab (sin depender del delta)
 const p6=crypto.randomUUID();
 r=await receive(phys,p6,"POTASSIUM","7.0");j=await r.json();ok(j.critical===true,"ABSOLUTE_PANIC_STILL_CRITICAL");
 // 7) REINTENTO idempotente de un resultado con Δ crítico (misma llave, mismo cuerpo) -> 200 con la respuesta original.
 //    Antes el "previo" era el propio resultado ya guardado: el payload cambiaba y el kernel respondía conflicto.
 const p7=crypto.randomUUID();await receive(phys,p7,"CREATININE","0.9");
 const key=idem();const body=JSON.stringify({resultId:crypto.randomUUID(),patientId:p7,orderId:crypto.randomUUID(),analyte:"CREATININE",value:"1.9",unit:"mg/dL",occurredAt:at()});
 const send=()=>results.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":key}),body}));
 r=await send();j=await r.json();ok(r.status===201&&j.deltaFlagged===true&&j.replayed===false,"DELTA_RESULT_FIRST_201");
 r=await send();j=await r.json();ok(r.status===200&&j.replayed===true&&j.deltaFlagged===true&&j.critical===true,"DELTA_RESULT_REPLAY_200");
 // 8) la respuesta dice el estado REAL de la interpretación (no solo `critical`): anormal no crítico ≠ "dentro de rango"
 const p8=crypto.randomUUID();
 r=await receive(phys,p8,"POTASSIUM","5.8");j=await r.json();ok(j.critical===false&&j.status==="ABNORMAL"&&typeof j.interpretation==="string","ABNORMAL_STATUS_RETURNED");
 r=await receive(phys,crypto.randomUUID(),"POTASSIUM","4.2");j=await r.json();ok(j.status==="NORMAL"&&j.canonicalUnit==="mEq/L"&&j.unitAssumed===true,"NORMAL_STATUS_AND_ASSUMED_UNIT_DECLARED");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
