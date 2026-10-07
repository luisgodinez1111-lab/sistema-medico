// EPIC BC — Evidencia física: NEWS2 computado desde los últimos signos vitales del paciente (RLS-scoped).
// Registra vitales vía la ruta real y consulta GET /patients/:id/news2. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const vitals=await import("../../apps/web/app/api/v1/vitals/route");
const news2=await import("../../apps/web/app/api/v1/patients/[patientId]/news2/route");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["vital:write","patient:read","patient:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
// Reloj RELATIVO desde el lote 11b (R03-11): NEWS2 es una escala de deterioro AGUDO y descarta las tomas de más de 8 h.
// Con una fecha fija la prueba caducaba al día siguiente de escribirla.
let seq=0;const T0=Date.now()-2*3_600_000;const at=()=>new Date(T0+(seq++)*60000).toISOString();
const idem=()=>crypto.randomUUID();
const{result,ok,fin}=libro();
const U:Record<string,string>={BP:"mmHg",HR:"lpm",TEMP:"C",SPO2:"%",RESP:"rpm"};
async function rec(t:string,pat:string,vitalType:string,value:string,when?:string){await vitals.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:pat,vitalType,value,unit:U[vitalType]??"u",occurredAt:when??at()})}));}
// Auditoría C-09: el O₂ suplementario y el nivel de conciencia se DECLARAN (?o2=&avpu=); NEWS2 exige un adulto registrado.
async function getNews2(t:string,pat:string,qs="?o2=false&avpu=A"){const r=await news2.GET(new Request("http://l/"+qs,{headers:H(t)}),PP(pat));return{status:r.status,body:await r.json()};}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba NEWS2 ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:"MALE",occurredAt:at()})}));}
try{
 const phys=tok();
 // 1) paciente estable -> score 0, LOW
 const p1=crypto.randomUUID();await reg(phys,p1,50);
 for(const[k,v]of[["RESP","16"],["SPO2","98"],["TEMP","36.8"],["BP","120/80"],["HR","72"]]as const)await rec(phys,p1,k,v);
 let g=await getNews2(phys,p1);ok(g.status===200&&g.body.news2.score===0&&g.body.news2.band==="LOW"&&g.body.news2.complete===true,"STABLE_SCORE_0_LOW");
 // 1b) los mismos vitales SIN declarar O₂ ni conciencia: score parcial -> INCOMPLETE, nunca "LOW" (auditoría C-09)
 g=await getNews2(phys,p1,"");ok(g.body.news2.band==="INCOMPLETE"&&g.body.news2.scoreIsLowerBound===true&&g.body.news2.escalation===true&&/cota inferior/.test(g.body.note),"UNDECLARED_O2_IS_INCOMPLETE_NOT_LOW");
 // 1c) con O₂ suplementario declarado, el score sube 2 y la escala 2 cambia la lectura de la SpO₂
 g=await getNews2(phys,p1,"?o2=true&avpu=A");ok(g.body.news2.score===2&&g.body.news2.params.supplementalO2===2,"SUPPLEMENTAL_O2_SCORES_2");
 g=await getNews2(phys,p1,"?o2=true&avpu=A&spo2Scale=2");ok(g.body.news2.spo2Scale===2&&g.body.news2.params.spo2===3,"SCALE_2_HYPEROXIA_ON_O2_SCORES_3");
 // 2) paciente en deterioro -> score alto, HIGH, escalamiento
 const p2=crypto.randomUUID();await reg(phys,p2,60);
 for(const[k,v]of[["RESP","24"],["SPO2","91"],["TEMP","39.2"],["BP","95/60"],["HR","125"]]as const)await rec(phys,p2,k,v);
 g=await getNews2(phys,p2);ok(g.status===200&&g.body.news2.band==="HIGH"&&g.body.news2.escalation===true,"DETERIORATING_HIGH_ESCALATION");
 // 3) usa el ÚLTIMO valor: re-registrar SpO2 normal baja el score respecto al deterioro
 await rec(phys,p2,"SPO2","98");await rec(phys,p2,"RESP","16");await rec(phys,p2,"TEMP","36.8");await rec(phys,p2,"BP","120/80");await rec(phys,p2,"HR","72");
 g=await getNews2(phys,p2);ok(g.body.news2.score===0,"USES_LATEST_VALUE_RECOVERED");
 // 4) parámetros faltantes se reportan; consciencia nunca se registra como vital -> siempre en missing
 const p3=crypto.randomUUID();await reg(phys,p3,40);await rec(phys,p3,"HR","72");
 g=await getNews2(phys,p3,"");ok(g.body.news2.missing.includes("consciousness")&&g.body.news2.missing.includes("resp")&&g.body.news2.missing.includes("supplementalO2"),"MISSING_PARAMS_REPORTED");
 // 5) aislamiento por paciente: un paciente registrado sin vitales -> todo faltante, score 0, INCOMPLETE
 const p4=crypto.randomUUID();await reg(phys,p4,40);g=await getNews2(phys,p4,"");ok(g.body.news2.score===0&&g.body.news2.missing.length>=5&&g.body.news2.band==="INCOMPLETE","PER_PATIENT_ISOLATION");
 // 5b) pediatría: NEWS2 no está validado -> no computable con la razón
 const p5=crypto.randomUUID();await reg(phys,p5,8);g=await getNews2(phys,p5);ok(g.status===200&&g.body.computable===false&&/16 años/.test(g.body.reason),"PEDIATRIC_NOT_COMPUTABLE");
 // 5c) R03-11: tomas OBSOLETAS (más de 8 h) no alimentan una escala de deterioro agudo: salen del score, se declaran
 //     como no utilizables y el resultado queda como cota inferior — nunca como "riesgo bajo" con datos de anteayer.
 const p6=crypto.randomUUID();await reg(phys,p6,50);const vieja=new Date(Date.now()-40*3_600_000).toISOString();
 for(const[k,v]of[["RESP","16"],["SPO2","98"],["TEMP","36.8"],["BP","120/80"],["HR","72"]]as const)await rec(phys,p6,k,v,vieja);
 g=await getNews2(phys,p6);
 ok(g.body.news2.complete===false&&g.body.news2.band==="INCOMPLETE","STALE_VITALS_INCOMPLETE");
 ok(Array.isArray(g.body.excludedInputs)&&g.body.excludedInputs.length===5,"STALE_VITALS_DECLARED_EXCLUDED");
 ok(g.body.inputs.length===0,"STALE_VITALS_NOT_IN_PROVENANCE");
 // 5d) la procedencia de un paciente con tomas vigentes sí trae la unidad canónica y la antigüedad
 g=await getNews2(phys,p1);
 ok(g.body.inputs.length===5&&g.body.inputs.every((i:{unit:string;ageHours:number})=>i.unit.length>0&&i.ageHours<8),"FRESH_PROVENANCE");
 // 6) sin scope patient:read -> 403
 const noScope=tok(["vital:write"]);g=await getNews2(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
