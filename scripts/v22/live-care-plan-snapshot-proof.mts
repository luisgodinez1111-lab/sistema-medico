// EPIC X/UI — Evidencia física: snapshot del Plan de cuidado de un paciente (vista Plan de cuidado). Compone
// problemas asociados (descripción+estado) + conteos (problemas/medicamentos/alergias) + metas del plan
// (CarePlan) + métricas (HbA1c de labs, TA/Peso/IMC de vitales). Determinista, RLS-scoped. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const prR=await import("../../apps/web/app/api/v1/problems/route");
const alR=await import("../../apps/web/app/api/v1/allergies/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const vitR=await import("../../apps/web/app/api/v1/vitals/route");
const cpR=await import("../../apps/web/app/api/v1/care-plans/route");
const cpActR=await import("../../apps/web/app/api/v1/care-plans/[carePlanId]/activation/route");
const snapR=await import("../../apps/web/app/api/v1/patients/[patientId]/care-plan/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","problem:write","allergy:write","result:write","vital:write","careplan:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Ana López García ${p.slice(0,8)}`,birthDate:birth(34),sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function prob(t:string,p:string,code:string){await prR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code,occurredAt:at()})}));}
async function allergy(t:string,p:string,s:string){await alR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:crypto.randomUUID(),patientId:p,substance:s,severity:"MODERATE",reaction:"exantema",occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,unit:canonicalUnitOf(a)??"mg/dL",occurredAt:at()})}));}
async function vital(t:string,p:string,vt:string,v:string,u:string,a:string){await vitR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType:vt,value:v,unit:u,occurredAt:a})}));}
async function goal(t:string,p:string,category:string,g:string){const id=crypto.randomUUID();await cpR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({carePlanId:id,patientId:p,category,goal:g,occurredAt:at()})}));return id;}
async function activateGoal(t:string,id:string){return cpActR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({carePlanId:id})});}
async function snap(t:string,p:string){const r=await snapR.GET(new Request("http://l/",{method:"GET",headers:H(t)}),{params:Promise.resolve({patientId:p})});return{status:r.status,body:await r.json()};}
const{result,ok,fin}=libro();
try{
 const phys=tok();const p=crypto.randomUUID();await reg(phys,p);
 await prob(phys,p,"E11.9");await prob(phys,p,"I10");await prob(phys,p,"E66.9"); // Diabetes / HTA / Obesidad
 await allergy(phys,p,"Penicilina");
 await res(phys,p,"HBA1C","8.1");
 const va=at();await vital(phys,p,"BP","138/86","mmHg",va);await vital(phys,p,"WEIGHT","78","kg",va);await vital(phys,p,"HEIGHT","161","cm",va);
 const g1=await goal(phys,p,"DIABETES","Lograr HbA1c < 7% en 3 meses");
 await goal(phys,p,"HYPERTENSION","Mantener TA < 130/80 mmHg");
 await activateGoal(phys,g1);

 const S=await snap(phys,p);ok(S.status===200,"SNAP_200");
 const b=S.body as{counts:{problems:number;medications:number;allergies:number};problems:{code:string;description:string;statusLabel:string}[];goals:{category:string;goal:string;statusLabel:string}[];metrics:{hba1c:{value:number;unit:string|null;occurredAt:string;ageDays:number}|null;bp:string|null;weight:string|null;imc:string|null}};
 // problemas asociados con descripción real (CIE-10)
 ok(b.problems.length===3,"THREE_PROBLEMS");
 ok(b.problems.find(x=>x.code==="E11.9")?.description?.toLowerCase().includes("diabetes")??false,"PROBLEM_DESCRIPTION");
 ok(b.problems.every(x=>!!x.statusLabel),"PROBLEM_STATUS_LABEL");
 // conteos
 ok(b.counts.problems===3,"COUNT_PROBLEMS_3");
 ok(b.counts.allergies===1,"COUNT_ALLERGIES_1");
 // metas del plan
 ok(b.goals.length===2,"TWO_GOALS");
 ok(b.goals.some(x=>x.category==="DIABETES"&&x.goal.includes("HbA1c")),"GOAL_CONTENT");
 ok(b.goals.find(x=>x.category==="DIABETES")?.statusLabel==="Activa","GOAL_ACTIVATED");
 ok(b.goals.find(x=>x.category==="HYPERTENSION")?.statusLabel==="Propuesta","GOAL_PROPOSED");
 // métricas reales
 // R03-10: la métrica viaja con UNIDAD y FECHA (antes era un «8.1» sin nada: el plan se construía sobre un número que
 // podía ser de hace dos años sin que nadie lo notara).
 ok(b.metrics.hba1c?.value===8.1&&b.metrics.hba1c?.unit==="%","METRIC_HBA1C_WITH_UNIT");
 ok(typeof b.metrics.hba1c?.occurredAt==="string"&&b.metrics.hba1c!.ageDays>=0,"METRIC_HBA1C_WITH_DATE");
 ok(b.metrics.bp==="138/86","METRIC_BP");
 ok(b.metrics.weight==="78","METRIC_WEIGHT");
 ok(b.metrics.imc==="30.1","METRIC_IMC_DERIVED");

 // sin scope -> 403
 const noScope=await snap(tok(["patient:read"]),p);
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
