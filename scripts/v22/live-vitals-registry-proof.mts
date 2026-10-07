// EPIC E/UI (Lote E) — Evidencia física: registro POBLACIONAL de signos vitales (vista Signos vitales › «Toda la
// clínica»). Registra lecturas de varios pacientes, enmienda una (el valor VIGENTE debe ser el enmendado) y marca
// otra como capturada por error (NO debe aparecer). GET /api/v1/vitals -> filas clínica-wide + conteos coherentes
// (críticos/anormales/pacientes) calculados en la base. RLS-scoped. vs Postgres local.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const vitR=await import("../../apps/web/app/api/v1/vitals/route");
const amR=await import("../../apps/web/app/api/v1/vitals/[vitalId]/amendment/route");
const emR=await import("../../apps/web/app/api/v1/vitals/[vitalId]/error-mark/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","vital:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();const at=new Date().toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birth(40),sexAtBirth:"FEMALE",occurredAt:at})}));}
async function vital(t:string,p:string,vitalType:string,value:string,unit:string){const id=crypto.randomUUID();const r=await vitR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:id,patientId:p,vitalType,value,unit,occurredAt:at})}));return{id,version:Number((await r.json()).version??1)};}
async function amend(t:string,id:string,ver:number,value:string,unit:string){return amR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(ver)}),body:JSON.stringify({value,unit,reason:"Corrección de captura",occurredAt:at})}),{params:Promise.resolve({vitalId:id})});}
async function errorMark(t:string,id:string,ver:number){return emR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(ver)}),body:JSON.stringify({reason:"Paciente equivocado",occurredAt:at})}),{params:Promise.resolve({vitalId:id})});}
async function registry(t:string){const r=await vitR.GET(new Request("http://l/api/v1/vitals",{headers:H(t)}));return{status:r.status,body:await r.json()};}
type Row={vitalId:string;patientId:string;vitalType:string;value:string;unit:string;status:string;critical:boolean};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();
 const p1=crypto.randomUUID();await reg(phys,p1,`Ana Registro ${p1.slice(0,8)}`);
 const p2=crypto.randomUUID();await reg(phys,p2,`Beto Registro ${p2.slice(0,8)}`);
 // p1: BP + HR + una TEMP que se ENMIENDA a 39.5 (fiebre)
 await vital(phys,p1,"BP","180/110","mmHg");
 await vital(phys,p1,"HR","72","lpm");
 const temp=await vital(phys,p1,"TEMP","36.5","°C");
 const am=await amend(phys,temp.id,temp.version,"39.5","°C");ok(am.status<400,"AMEND_OK");
 // p2: HR válida + una WEIGHT que se marca ENTERED_IN_ERROR (no debe aparecer)
 await vital(phys,p2,"HR","80","lpm");
 const wt=await vital(phys,p2,"WEIGHT","70","kg");
 const em=await errorMark(phys,wt.id,wt.version);ok(em.status<400,"ERROR_MARK_OK");

 const g=await registry(phys);ok(g.status===200,"REGISTRY_200");
 const items=g.body.items as Row[];
 // 4 lecturas vigentes: p1(BP,HR,TEMP) + p2(HR); la WEIGHT marcada por error queda fuera.
 ok(g.body.total===4,"TOTAL_EXCLUDES_ERROR");
 ok(items.length===4,"ITEMS_LEN");
 ok(!items.some(r=>r.vitalId===wt.id),"ERROR_READING_ABSENT");
 // el valor VIGENTE de la TEMP es el enmendado (39.5), no el original (36.5).
 const t=items.find(r=>r.vitalId===temp.id)!;ok(t.value==="39.5","AMENDED_VALUE_VIGENTE");
 // pacientes DISTINTOS con lecturas vigentes = 2.
 ok(g.body.patientsCount===2,"PATIENTS_DISTINCT");
 // los conteos del resumen son COHERENTES con las filas (críticos = critical; anormales = ABNORMAL no crítico).
 const crit=items.filter(r=>r.critical).length;
 const abn=items.filter(r=>r.status==="ABNORMAL"&&!r.critical).length;
 ok(g.body.criticalCount===crit,"CRITICAL_COUNT_COHERENT");
 ok(g.body.abnormalCount===abn,"ABNORMAL_COUNT_COHERENT");
 // la TEMP 39.5 no es normal (fiebre): al menos una lectura marcada crítica o anormal.
 ok(crit+abn>=1,"HAS_FLAGGED");
 // sin scope de signos vitales -> 403.
 const noScope=await registry(tok(["patient:write"]));ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
