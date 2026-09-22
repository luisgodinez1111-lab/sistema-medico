// EPIC CA — Evidencia física: gradiente alveolo-arterial de O2 desde PaO2 + PaCO2 + edad. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-ca-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const aa=await import("../../apps/web/app/api/v1/patients/[patientId]/aa-gradient/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000/* reloj RELATIVO: las calculadoras rechazan datos obsoletos; una fecha fija haría caducar la prueba */;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:"Prueba",birthDate:birth(y),sexAtBirth:"MALE",occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,occurredAt:at()})}));}
// Auditoría C-18: la FiO₂ con la que se tomó la gasometría es OBLIGATORIA (el sistema no la registra y no la asume).
async function get(t:string,p:string,q="?fio2=0.21"){const r=await aa.GET(new Request("http://l/"+q,{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) intercambio alterado: 60a, PaO2 55, PaCO2 40 -> gradiente elevado
 const p1=crypto.randomUUID();await reg(phys,p1,60);await res(phys,p1,"PO2","55");await res(phys,p1,"PCO2","40");
 let g=await get(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.elevated===true&&/intercambio/i.test(g.body.interpretation),"ELEVATED_GRADIENT");
 // 2) hipoventilación pura: 40a, PaO2 65, PaCO2 60 -> gradiente normal
 const p2=crypto.randomUUID();await reg(phys,p2,40);await res(phys,p2,"PO2","65");await res(phys,p2,"PCO2","60");
 g=await get(phys,p2);ok(g.body.elevated===false,"NORMAL_GRADIENT_HYPOVENTILATION");
 // 3) parametrizable por altitud: ?atm=585 baja la PAO2 vs nivel del mar
 const seaPAO2=(await get(phys,p1)).body.alveolarPo2;
 g=await get(phys,p1,"?fio2=0.21&atm=585");ok(g.body.alveolarPo2<seaPAO2&&g.body.atmPressure===585,"ALTITUDE_LOWERS_PAO2");
 // 4) usa el PaO2 MÁS RECIENTE: sube a 95 -> gradiente baja
 const beforeGrad=(await get(phys,p1)).body.gradient;await res(phys,p1,"PO2","95");g=await get(phys,p1);ok(g.body.gradient<beforeGrad,"USES_LATEST_PO2");
 // 5) falta PCO2 -> no computable
 const p3=crypto.randomUUID();await reg(phys,p3,50);await res(phys,p3,"PO2","80");
 g=await get(phys,p3);ok(g.body.computable===false&&g.body.missing.includes("PCO2"),"MISSING_PCO2");
 // 5b) SIN FiO₂ declarada -> no computable (antes se asumía aire ambiente y un paciente con O₂ salía "sin alteración")
 g=await get(phys,p1,"");ok(g.body.computable===false&&/FiO/.test(g.body.reason),"FIO2_REQUIRED");
 g=await get(phys,p1,"?fio2=1.5");ok(g.body.computable===false,"FIO2_OUT_OF_RANGE_REJECTED");
 // 5c) con O₂ suplementario el "esperado por edad" NO aplica: nunca se declara elevado contra la fórmula de aire ambiente
 g=await get(phys,p1,"?fio2=0.4");ok(g.body.computable===true&&g.body.expectedValid===false&&g.body.elevated===false&&typeof g.body.pfRatio==="number","SUPPLEMENTAL_O2_NO_ROOM_AIR_FORMULA");
 // 5d) toda respuesta computable declara con QUÉ datos se calculó (procedencia) y el algoritmo
 ok(Array.isArray(g.body.inputs)&&g.body.inputs.length===2&&g.body.inputs.every((x:{resultId?:string;occurredAt?:string})=>!!x.resultId&&!!x.occurredAt),"PROVENANCE_RETURNED");
 // 6) no registrado -> 404; sin scope -> 403
 g=await get(phys,crypto.randomUUID());ok(g.status===404,"UNREGISTERED_404");
 const noScope=tok(["result:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
