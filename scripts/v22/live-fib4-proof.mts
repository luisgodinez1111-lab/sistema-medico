// EPIC BR — Evidencia física: FIB-4 (fibrosis hepática) desde edad + AST + ALT + plaquetas. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const f4=await import("../../apps/web/app/api/v1/patients/[patientId]/fib4/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000/* reloj RELATIVO: las calculadoras rechazan datos obsoletos; una fecha fija haría caducar la prueba */;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const{result,ok,fin}=libro();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:"MALE",occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,unit:canonicalUnitOf(a)??"mg/dL",occurredAt:at()})}));}
// Variante con control total de la captura (hora, unidad) para probar unidades, plausibilidad y vigencia de punta a punta.
async function resAt(t:string,p:string,a:string,v:string,occurredAt:string,extra:Record<string,unknown>={}){const r=await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,unit:canonicalUnitOf(a)??"mg/dL",occurredAt,...extra})}));return{status:r.status,body:await r.json()};}
const daysAgo=(d:number)=>new Date(Date.now()-d*86_400_000).toISOString();
async function get(t:string,p:string){const r=await f4.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) 65a, AST 80, ALT 40, plaq 100 -> FIB-4 ~8.2, HIGH
 const p1=crypto.randomUUID();await reg(phys,p1,65);
 for(const[a,v]of[["AST","80"],["ALT","40"],["PLATELETS","100"]]as const)await res(phys,p1,a,v);
 let g=await get(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.fib4>2.67&&g.body.risk==="HIGH","HIGH_RISK");
 // 2) 40a, AST 25, ALT 25, plaq 250 -> ~0.8, LOW
 const p2=crypto.randomUUID();await reg(phys,p2,40);
 for(const[a,v]of[["AST","25"],["ALT","25"],["PLATELETS","250"]]as const)await res(phys,p2,a,v);
 g=await get(phys,p2);ok(g.body.risk==="LOW","LOW_RISK");
 // 3) usa el valor MÁS RECIENTE: plaquetas caen a 90 -> sube el FIB-4
 const before=g.body.fib4;await res(phys,p2,"PLATELETS","90");g=await get(phys,p2);ok(g.body.fib4>before,"USES_LATEST_PLATELETS");
 // 4) falta un analito -> no computable
 const p3=crypto.randomUUID();await reg(phys,p3,50);await res(phys,p3,"AST","40");await res(phys,p3,"ALT","30");
 g=await get(phys,p3);ok(g.body.computable===false&&g.body.missing.includes("PLATELETS")&&/plaquetas/i.test(g.body.reason),"MISSING_ANALYTE");
 // 4b) Auditoría C-01 — plaquetas capturadas en /µL (250000) se CONVIERTEN a 10^3/µL: mismo FIB-4 que con "250"
 const p5=crypto.randomUUID();await reg(phys,p5,40);
 for(const[a,v,u]of[["AST","25","U/L"],["ALT","25","U/L"],["PLATELETS","250000","/µL"]]as const)await resAt(phys,p5,a,v,daysAgo(1),{unit:u});
 g=await get(phys,p5);ok(g.body.computable===true&&g.body.risk==="LOW"&&g.body.fib4>0.5&&g.body.fib4<1.3,"PLATELETS_PER_UL_CONVERTED"); // 40a·25/(250·√25)=0.8
 // 4c) ...y el mismo número SIN unidad se RECHAZA al capturarlo (antes: FIB-4 = 0.00 -> "fibrosis poco probable")
 const bad=await resAt(phys,p5,"PLATELETS","250000",daysAgo(0));ok(bad.status===400&&bad.body.error.code==="VALIDATION_ERROR","IMPLAUSIBLE_PLATELETS_REJECTED_400");
 const badUnit=await resAt(phys,p5,"PLATELETS","250",daysAgo(0),{unit:"mg/dL"});ok(badUnit.status===400,"UNKNOWN_UNIT_REJECTED_400");
 // 4d) panel hepático OBSOLETO (más de 180 días) -> no computable
 const p6=crypto.randomUUID();await reg(phys,p6,50);
 for(const[a,v]of[["AST","80"],["ALT","40"],["PLATELETS","100"]]as const)await resAt(phys,p6,a,v,daysAgo(400));
 g=await get(phys,p6);ok(g.body.computable===false&&g.body.stale.length===3,"STALE_LIVER_PANEL_NOT_COMPUTABLE");
 // 5) paciente no registrado -> 404
 g=await get(phys,crypto.randomUUID());ok(g.status===404,"UNREGISTERED_404");
 // 6) sin scope patient:read -> 403
 const noScope=tok(["result:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
