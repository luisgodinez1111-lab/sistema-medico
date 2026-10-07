// EPIC BA/UI — Evidencia física: snapshot de Seguimiento de un paciente (vista Seguimiento). Compone Tareas de
// seguimiento (obligaciones), Tendencia de signos vitales (series+promedios) e Indicadores clave (HbA1c/LDL de
// labs, Peso/IMC de vitales, primero->último). Determinista, RLS-scoped. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const prR=await import("../../apps/web/app/api/v1/problems/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const vitR=await import("../../apps/web/app/api/v1/vitals/route");
const obR=await import("../../apps/web/app/api/v1/obligations/route");
const obComp=await import("../../apps/web/app/api/v1/obligations/[obligationId]/completion/route");
const fuR=await import("../../apps/web/app/api/v1/patients/[patientId]/follow-up/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","problem:write","result:write","vital:write","obligation:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-03-01T09:00:00.000Z");const at=()=>new Date(ts+=86400000*20).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Ana López García ${p.slice(0,8)}`,birthDate:birth(34),sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function prob(t:string,p:string,code:string){await prR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code,occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string,when:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,unit:canonicalUnitOf(a)??"mg/dL",occurredAt:when})}));}
async function vital(t:string,p:string,vt:string,v:string,u:string,when:string){await vitR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType:vt,value:v,unit:u,occurredAt:when})}));}
async function toma(t:string,p:string,when:string,bp:string,hr:string,w:string,h:string){await vital(t,p,"BP",bp,"mmHg",when);await vital(t,p,"HR",hr,"lpm",when);await vital(t,p,"WEIGHT",w,"kg",when);await vital(t,p,"HEIGHT",h,"cm",when);}
async function obl(t:string,p:string,kind:string,dueAt:string){const id=crypto.randomUUID();await obR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:id,patientId:p,ownerId:crypto.randomUUID(),dueAt,kind,occurredAt:at()})}));return id;}
async function complete(t:string,id:string){return obComp.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({evidence:"Realizado en la consulta de hoy",occurredAt:at()})}),{params:Promise.resolve({obligationId:id})});}
async function fu(t:string,p:string){const r=await fuR.GET(new Request("http://l/",{method:"GET",headers:H(t)}),{params:Promise.resolve({patientId:p})});return{status:r.status,body:await r.json()};}
const{result,ok,fin}=libro();
try{
 const phys=tok();const p=crypto.randomUUID();await reg(phys,p);
 await prob(phys,p,"E11.9");await prob(phys,p,"I10");await prob(phys,p,"E66.9");
 // labs en el tiempo (primero->último): HbA1c 8.1 -> 7.2 ; LDL 142 -> 110
 await res(phys,p,"HBA1C","8.1","2026-06-20T11:00:00.000Z");await res(phys,p,"HBA1C","7.2","2026-09-17T10:00:00.000Z");
 await res(phys,p,"LDL","142","2026-06-20T11:00:00.000Z");await res(phys,p,"LDL","110","2026-09-17T10:00:00.000Z");
 // vitales en 2 tomas (peso 69.4 -> 67.3)
 await toma(phys,p,"2026-05-18T10:15:00.000Z","128/84","78","69.4","149");
 await toma(phys,p,"2026-09-17T10:24:00.000Z","124/82","74","67.3","149");
 // 3 tareas de seguimiento EXPLÍCITAS; una completada (los labs anormales de arriba crean además sus propias obligaciones)
 await obl(phys,p,"Solicitar HbA1c en 3 meses","2026-10-15T00:00:00.000Z");
 const t2=await obl(phys,p,"Reforzar plan nutricional","2026-09-17T00:00:00.000Z");
 await obl(phys,p,"Valorar ajuste de metformina","2026-10-15T00:00:00.000Z");
 const cr=await complete(phys,t2);ok(cr.status===200||cr.status===201,"COMPLETE_OK");

 const S=await fu(phys,p);ok(S.status===200,"FU_200");
 const b=S.body as{tasks:{task:string;statusLabel:string;done:boolean}[];vitalsTrend:{series:{BP:number[];WEIGHT:number[]};avg:{ta:string|null;hr:number|null;weight:number|null;imc:number|null}};indicators:{hba1c:{first:number;last:number}|null;ldl:{first:number;last:number}|null;weight:{first:number;last:number}|null;imc:{first:number;last:number}|null};counts:{problems:number}};
 // tareas: las 3 de seguimiento EXPLÍCITAS están presentes...
 const explicitas=["Solicitar HbA1c en 3 meses","Reforzar plan nutricional","Valorar ajuste de metformina"];
 ok(explicitas.every(n=>b.tasks.some(x=>x.task===n)),"THREE_EXPLICIT_TASKS_PRESENT");
 // ...y además aparecen las obligaciones de seguimiento DERIVADAS de los labs anormales (HbA1c 8.1 y 7.2, LDL 142): el
 // sistema las crea solo (Zero Lost Follow-Up, ANORMAL ⇒ ROUTINE no bloqueante), así que el snapshot muestra más de tres.
 ok(b.tasks.filter(x=>x.task==="ABNORMAL_RESULT_FOLLOWUP").length===3,"ABNORMAL_RESULT_FOLLOWUPS_DERIVED");
 ok(b.tasks.find(x=>x.task==="Reforzar plan nutricional")?.done===true,"TASK_COMPLETED");
 ok(b.tasks.find(x=>x.task==="Solicitar HbA1c en 3 meses")?.statusLabel==="Pendiente","TASK_PENDING");
 // tendencia de vitales
 ok(b.vitalsTrend.series.BP.length===2&&b.vitalsTrend.series.BP[0]===128&&b.vitalsTrend.series.BP[1]===124,"BP_SERIES");
 ok(b.vitalsTrend.avg.ta==="124/82","LAST_TA");
 ok(b.vitalsTrend.avg.weight===67.3,"LAST_WEIGHT");
 // indicadores clave primero->último
 ok(b.indicators.hba1c?.first===8.1&&b.indicators.hba1c?.last===7.2,"HBA1C_DELTA");
 ok(b.indicators.ldl?.first===142&&b.indicators.ldl?.last===110,"LDL_DELTA");
 ok(b.indicators.weight?.first===69.4&&b.indicators.weight?.last===67.3,"WEIGHT_DELTA");
 ok(b.indicators.imc?.last===30.3,"IMC_LAST_DERIVED");
 // conteos
 ok(b.counts.problems===3,"COUNT_PROBLEMS");

 // sin scope -> 403
 const noScope=await fu(tok(["patient:read"]),p);
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
