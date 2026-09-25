// EPIC BL — Evidencia física: eGFR (CKD-EPI 2021) + estadio ERC desde creatinina + edad/sexo del paciente. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bl-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const pat=await import("../../apps/web/app/api/v1/patients/route");
const res=await import("../../apps/web/app/api/v1/results/route");
const eg=await import("../../apps/web/app/api/v1/patients/[patientId]/egfr/route");
const vitR=await import("../../apps/web/app/api/v1/vitals/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write","vital:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
const ISO=new Date(Date.now()-3_600_000).toISOString()/* reloj RELATIVO: la creatinina obsoleta ya no se usa para el eGFR */;const idem=()=>crypto.randomUUID();
let ts=Date.parse(ISO);const nextAt=()=>new Date(ts+=60000).toISOString(); // timestamps crecientes (la más reciente gana)
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
// La fecha de nacimiento se deriva de ISO —el mismo instante con el que se REGISTRA al paciente—, no de `new Date()`.
// Con `new Date()` esta prueba fallaba SEGÚN LA HORA DEL DÍA: cerca de la medianoche UTC `toISOString()` ya devuelve la
// fecha de MAÑANA, así que el lactante (`yearsAgo:0`) se registraba con nacimiento POSTERIOR a su propio registro, el
// servidor lo rechazaba con 400 (validación correcta) y la prueba no llegaba a comprobar el rango de Schwartz.
function birth(yearsAgo:number){const d=new Date(Date.parse(ISO));d.setUTCFullYear(d.getUTCFullYear()-yearsAgo);return d.toISOString().slice(0,10);}
async function register(t:string,p:string,sex:string,yearsAgo:number){await pat.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(yearsAgo),sexAtBirth:sex,occurredAt:ISO})}));}
async function creat(t:string,p:string,value:string){await res.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:"CREATININE",value,unit:"mg/dL",occurredAt:nextAt()})}));}
// Variante con control total de la captura (hora, unidad) para probar unidades, plausibilidad y vigencia de punta a punta.
async function resAt(t:string,p:string,a:string,v:string,occurredAt:string,extra:Record<string,unknown>={}){const r=await res.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,unit:canonicalUnitOf(a)??"mg/dL",occurredAt,...extra})}));return{status:r.status,body:await r.json()};}
const daysAgo=(d:number)=>new Date(Date.now()-d*86_400_000).toISOString();
async function vital(t:string,p:string,vitalType:string,value:string,unit:string){await vitR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType,value,unit,occurredAt:new Date().toISOString()})}));}
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
 // 4) R03-01: pediátrico (~5a). Antes la respuesta era «usar Schwartz» y la función renal pediátrica NO SE PODÍA
 //    estimar (la ecuación no existía en el repositorio). Ahora se calcula con Schwartz de cabecera, que exige la TALLA.
 const p3=crypto.randomUUID();await register(phys,p3,"FEMALE",5);await creat(phys,p3,"0.4");
 g=await egfr(phys,p3);
 ok(g.body.computable===false&&g.body.reasonCode==="HEIGHT_REQUIRED"&&/TALLA/.test(g.body.reason),"PEDIATRIC_NEEDS_HEIGHT");
 await vital(phys,p3,"HEIGHT","110","cm");
 g=await egfr(phys,p3);
 ok(g.body.computable===true&&g.body.pediatric===true&&g.body.egfr===113.6,"SCHWARTZ_BEDSIDE_COMPUTED");
 ok(g.body.algorithm.id==="SCHWARTZ-BEDSIDE-2009"&&g.body.heightCm===110,"SCHWARTZ_ALGORITHM_DECLARED");
 ok(g.body.stage===null&&g.body.gCategory===null&&g.body.ckdStaged===false,"PEDIATRIC_NOT_CKD_STAGED");
 ok(/barrera renal de prescripción NO lo usa/.test(g.body.caveat),"PEDIATRIC_EGFR_NOT_WIRED_TO_BARRIER");
 // 4b) R03-01: un lactante (<1 año) queda fuera del dominio de Schwartz: se declara, no se calcula
 const p3b=crypto.randomUUID();await register(phys,p3b,"FEMALE",0);await creat(phys,p3b,"0.3");await vital(phys,p3b,"HEIGHT","55","cm");
 g=await egfr(phys,p3b);ok(g.body.computable===false&&g.body.reasonCode==="OUT_OF_AGE_RANGE","INFANT_OUT_OF_SCHWARTZ_RANGE");
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
