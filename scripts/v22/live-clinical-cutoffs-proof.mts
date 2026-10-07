// Auditoría multi-agente — DECISIONES CLÍNICAS DEL DUEÑO (cortes de laboratorio), prueba EN VIVO contra PostgreSQL real:
//   D1) BORDES CRÍTICOS INCLUSIVOS: el valor de pánico EXACTO ya es crítico (troponina 0.04 ng/mL, potasio 6.5 / 2.5 mEq/L),
//       y el tope del rango NORMAL sigue estricto (potasio 5.1 mEq/L es NORMAL — contraejemplo protegido).
//   D2) AYUNO en glucosa: declarar ayuno usa el corte de ayuno (≥126 anormal); sin declararlo usa el de aleatoria (200) y lo
//       DICE ("sin declarar ayuno"); el ayuno declarado se PERSISTE en el evento del resultado.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts");
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{readAggregateEvents}=await import("../../apps/web/lib/clinical-runtime");
const{resolveVerified}=await import("../../apps/web/lib/http-command");
const results=await import("../../apps/web/app/api/v1/results/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const phys=signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes:["result:write","result:read","patient:read"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
const H=(x:Record<string,string>={})=>({"content-type":"application/json",authorization:"Bearer "+phys,...x});
const idem=()=>crypto.randomUUID();let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60000).toISOString();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
// Recibe UN resultado para un paciente NUEVO cada vez (aísla la clasificación del delta longitudinal, que es por
// paciente+analito: mandar varios valores del mismo analito al mismo paciente dispararía un Δ y enmascararía el corte).
async function recibir(analyte:string,value:string,unit:string,extra:Record<string,unknown>={}){
 const pat=crypto.randomUUID();await ensurePatientIn(TA,pat);const resultId=crypto.randomUUID();
 const r=await results.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem()}),body:JSON.stringify({resultId,patientId:pat,orderId:crypto.randomUUID(),analyte,value,unit,occurredAt:at(),...extra})}));
 return{resultId,status:r.status,body:await r.json() as Record<string,unknown>};
}
const ctx=resolveVerified(new Request("http://l/",{headers:H()})).ctx;
try{
 // === D1: bordes críticos INCLUSIVOS ===
 let r=await recibir("TROPONIN","0.04","ng/mL");
 ok(r.status===201&&r.body["critical"]===true&&r.body["status"]==="CRITICAL","D1_TROPONIN_0_04_EXACTO_ES_CRITICO"); // antes: NORMAL
 r=await recibir("TROPONIN","0.039","ng/mL");
 ok(r.status===201&&r.body["critical"]===false&&r.body["status"]==="NORMAL","D1_TROPONIN_JUSTO_DEBAJO_NORMAL");
 r=await recibir("POTASSIUM","6.5","mEq/L");
 ok(r.status===201&&r.body["critical"]===true&&r.body["status"]==="CRITICAL","D1_POTASIO_6_5_CRITICALHIGH_EXACTO_ES_CRITICO");
 r=await recibir("POTASSIUM","2.5","mEq/L");
 ok(r.status===201&&r.body["critical"]===true&&r.body["status"]==="CRITICAL","D1_POTASIO_2_5_CRITICALLOW_EXACTO_ES_CRITICO");
 // CONTRAEJEMPLO protegido: el tope del rango normal (abnormalHigh) sigue ESTRICTO -> 5.1 es NORMAL, no anormal ni crítico.
 r=await recibir("POTASSIUM","5.1","mEq/L");
 ok(r.status===201&&r.body["critical"]===false&&r.body["status"]==="NORMAL","D1_POTASIO_5_1_TOPE_NORMAL_SIGUE_NORMAL");

 // === D2: ayuno en glucosa ===
 // Sin declarar ayuno: corte aleatoria (200). 140 mg/dL cae NORMAL, y la interpretación DICE el criterio aplicado.
 r=await recibir("GLUCOSE","140","mg/dL");
 ok(r.status===201&&r.body["status"]==="NORMAL"&&/sin declarar ayuno/.test(String(r.body["interpretation"])),"D2_GLUCOSA_140_SIN_AYUNO_NORMAL_Y_LO_DICE");
 // Declarando ayuno: corte de ayuno (≥126 anormal). La MISMA cifra es ABNORMAL, y el ayuno se PERSISTE en el evento.
 const g=await recibir("GLUCOSE","140","mg/dL",{fasting:true});
 ok(g.status===201&&g.body["status"]==="ABNORMAL","D2_GLUCOSA_140_EN_AYUNO_ES_ABNORMAL");
 const ev=(await readAggregateEvents(ctx,g.resultId)).find(e=>e.payload["kind"]==="RECEIVED")?.payload??{};
 ok(ev["fasting"]===true,"D2_AYUNO_DECLARADO_SE_PERSISTE_EN_EL_EVENTO");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
