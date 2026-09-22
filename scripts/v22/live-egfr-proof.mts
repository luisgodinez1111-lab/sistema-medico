// EPIC BL — Evidencia física: eGFR (CKD-EPI 2021) + estadio ERC desde creatinina + edad/sexo del paciente. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bl-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const pat=await import("../../apps/web/app/api/v1/patients/route");
const res=await import("../../apps/web/app/api/v1/results/route");
const eg=await import("../../apps/web/app/api/v1/patients/[patientId]/egfr/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
const ISO=new Date(Date.now()-3_600_000).toISOString()/* reloj RELATIVO: la creatinina obsoleta ya no se usa para el eGFR */;const idem=()=>crypto.randomUUID();
let ts=Date.parse(ISO);const nextAt=()=>new Date(ts+=60000).toISOString(); // timestamps crecientes (la más reciente gana)
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(yearsAgo:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-yearsAgo);return d.toISOString().slice(0,10);}
async function register(t:string,p:string,sex:string,yearsAgo:number){await pat.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:"Prueba",birthDate:birth(yearsAgo),sexAtBirth:sex,occurredAt:ISO})}));}
async function creat(t:string,p:string,value:string){await res.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:"CREATININE",value,occurredAt:nextAt()})}));}
// Variante con control total de la captura (hora, unidad) para probar unidades, plausibilidad y vigencia de punta a punta.
async function resAt(t:string,p:string,a:string,v:string,occurredAt:string,extra:Record<string,unknown>={}){const r=await res.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,occurredAt,...extra})}));return{status:r.status,body:await r.json()};}
const daysAgo=(d:number)=>new Date(Date.now()-d*86_400_000).toISOString();
async function egfr(t:string,p:string){const r=await eg.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) hombre ~50a, Scr 1.0 -> eGFR normal (~92), G1
 const p1=crypto.randomUUID();await register(phys,p1,"MALE",50);await creat(phys,p1,"1.0");
 let g=await egfr(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.egfr>=85&&g.body.egfr<=98,"MALE_50_SCR1_NORMAL_EGFR");
 ok(g.body.gCategory==="G1"&&g.body.stage===null&&g.body.chronicity.status==="NOT_APPLICABLE","STAGE_G1"); // C-22: G1 no define ERC
 // 2) hombre ~70a, Scr 2.5 -> ERC avanzada (eGFR<45)
 const p2=crypto.randomUUID();await register(phys,p2,"MALE",70);await creat(phys,p2,"2.5");
 g=await egfr(phys,p2);ok(g.body.computable===true&&g.body.egfr<45&&["G3b","G4"].includes(g.body.gCategory),"ADVANCED_CKD");
 // C-22: con UNA creatinina el estadio de ERC NO se afirma (stage null, cronicidad no confirmada, sin albuminuria)
 ok(g.body.stage===null&&g.body.chronicity.status==="NOT_CONFIRMED"&&g.body.albuminuria.category===null,"SINGLE_CREATININE_DOES_NOT_STAGE_CKD");
 // 3) usa la creatinina MÁS RECIENTE: nueva creatinina 3.5 baja aún más el eGFR
 await creat(phys,p2,"3.5");g=await egfr(phys,p2);ok(g.body.creatinineMgDl===3.5,"USES_LATEST_CREATININE");
 // 3b) C-22: con una creatinina de hace ≥ 90 días también < 60 -> cronicidad CONFIRMADA y el estadio de ERC se afirma
 const p2b=crypto.randomUUID();await register(phys,p2b,"MALE",70);
 await resAt(phys,p2b,"CREATININE","2.4",daysAgo(120),{unit:"mg/dL"});await resAt(phys,p2b,"CREATININE","2.6",daysAgo(1),{unit:"mg/dL"});
 g=await egfr(phys,p2b);ok(g.body.chronicity.status==="CONFIRMED"&&typeof g.body.stage==="string"&&g.body.stage===g.body.gCategory,"CHRONICITY_CONFIRMED_WITH_90_DAY_PRIOR");
 // 3c) ...pero si hace ≥ 90 días la TFG era normal, la caída es RECIENTE: no se estadifica (lesión renal aguda hasta demostrar lo contrario)
 const p2c=crypto.randomUUID();await register(phys,p2c,"MALE",70);
 await resAt(phys,p2c,"CREATININE","1.0",daysAgo(120),{unit:"mg/dL"});await resAt(phys,p2c,"CREATININE","2.6",daysAgo(1),{unit:"mg/dL"});
 g=await egfr(phys,p2c);ok(g.body.chronicity.status==="NOT_CONFIRMED"&&g.body.stage===null&&/reciente|lesión renal aguda/i.test(g.body.chronicity.note),"RECENT_DROP_NOT_STAGED");
 // 4) pediátrico (~5a) -> no computable (Schwartz, no CKD-EPI)
 const p3=crypto.randomUUID();await register(phys,p3,"FEMALE",5);await creat(phys,p3,"0.4");
 g=await egfr(phys,p3);ok(g.body.computable===false&&/pedi/i.test(g.body.reason),"PEDIATRIC_NOT_COMPUTABLE");
 // 5) adulto sin creatinina -> no computable
 const p4=crypto.randomUUID();await register(phys,p4,"MALE",40);
 g=await egfr(phys,p4);ok(g.body.computable===false&&/creatinina/i.test(g.body.reason),"NO_CREATININE_NOT_COMPUTABLE");
 // 5b) Auditoría C-01 — creatinina en µmol/L (88.4 = 1.0 mg/dL): mismo eGFR que el caso 1, y la respuesta declara la procedencia
 const p5=crypto.randomUUID();await register(phys,p5,"MALE",50);const rc=await resAt(phys,p5,"CREATININE","88.4",daysAgo(1),{unit:"µmol/L"});
 ok(rc.status===201&&rc.body.canonicalValue===1&&rc.body.canonicalUnit==="mg/dL"&&rc.body.unitAssumed===false,"UMOL_CONVERTED_AT_RECEIVE");
 g=await egfr(phys,p5);ok(g.body.computable===true&&g.body.creatinineMgDl===1&&g.body.egfr>=85&&g.body.egfr<=98,"UMOL_SAME_EGFR_AS_MGDL");
 ok(Array.isArray(g.body.inputs)&&g.body.inputs[0]?.analyte==="CREATININE"&&g.body.algorithm?.id==="CKD-EPI-2021","PROVENANCE_AND_ALGORITHM_RETURNED");
 // 5c) 88.4 SIN unidad NO se acepta como mg/dL (antes: eGFR ≈ 0 -> "falla renal terminal" y bloqueo/alerta falsos)
 const bad=await resAt(phys,p5,"CREATININE","88.4",daysAgo(0));ok(bad.status===400,"IMPLAUSIBLE_CREATININE_REJECTED_400");
 // 5d) creatinina de hace 400 días -> no computable (no describe la función renal actual)
 const p6=crypto.randomUUID();await register(phys,p6,"MALE",60);await resAt(phys,p6,"CREATININE","1.1",daysAgo(400));
 g=await egfr(phys,p6);ok(g.body.computable===false&&g.body.stale.length===1&&/obsoleto/i.test(g.body.reason),"STALE_CREATININE_NOT_COMPUTABLE");
 // 6) paciente no registrado -> 404
 g=await egfr(phys,crypto.randomUUID());ok(g.status===404,"UNREGISTERED_404");
 // 7) sin scope patient:read -> 403
 const noScope=tok(["result:write"]);g=await egfr(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
