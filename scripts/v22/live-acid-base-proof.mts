// EPIC BX — Evidencia física: interpretación ácido-base (trastorno primario + Winters) desde pH/pCO2/HCO3. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bx-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const resR=await import("../../apps/web/app/api/v1/results/route");
const ab=await import("../../apps/web/app/api/v1/patients/[patientId]/acid-base/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["result:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000/* reloj RELATIVO: las calculadoras rechazan datos obsoletos; una fecha fija haría caducar la prueba */;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,occurredAt:at()})}));}
// Variante con control total de la captura (hora, unidad, muestra) para probar la guarda de entradas verificadas.
async function resAt(t:string,p:string,a:string,v:string,occurredAt:string,extra:Record<string,unknown>={}){const r=await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,occurredAt,...extra})}));return r.status;}
const hoursAgo=(h:number)=>new Date(Date.now()-h*3_600_000).toISOString();
async function get(t:string,p:string){const r=await ab.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) acidosis metabólica con compensación adecuada: pH 7.30, HCO3 12, pCO2 26 (esperado 26)
 const p1=crypto.randomUUID();
 for(const[a,v]of[["PH","7.30"],["BICARBONATE","12"],["PCO2","26"]]as const)await res(phys,p1,a,v);
 let g=await get(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.primary==="METABOLIC_ACIDOSIS"&&g.body.expectedPco2===26,"METABOLIC_ACIDOSIS_WINTERS");
 ok(/adecuada/i.test(g.body.compensation),"COMPENSATION_ADEQUATE");
 // 2) usa el pCO2 MÁS RECIENTE: sube a 40 -> acidosis respiratoria concurrente
 await res(phys,p1,"PCO2","40");g=await get(phys,p1);ok(/respiratoria concurrente/i.test(g.body.compensation),"MIXED_ON_LATEST_PCO2");
 // 3) acidosis respiratoria: pH 7.28, pCO2 60, HCO3 24
 const p2=crypto.randomUUID();
 for(const[a,v]of[["PH","7.28"],["PCO2","60"],["BICARBONATE","24"]]as const)await res(phys,p2,a,v);
 g=await get(phys,p2);ok(g.body.primary==="RESPIRATORY_ACIDOSIS","RESPIRATORY_ACIDOSIS");
 // 4) falta un analito -> no computable
 const p3=crypto.randomUUID();await res(phys,p3,"PH","7.4");await res(phys,p3,"PCO2","40");
 g=await get(phys,p3);ok(g.body.computable===false&&g.body.missing.includes("BICARBONATE")&&/bicarbonato/i.test(g.body.reason),"MISSING_ANALYTE");
 // 4b) Auditoría C-02 — gasometría OBSOLETA (3 días): no computable, con el analito en `stale`
 const p4=crypto.randomUUID();for(const[a,v]of[["PH","7.30"],["BICARBONATE","12"],["PCO2","26"]]as const)await resAt(phys,p4,a,v,hoursAgo(72));
 g=await get(phys,p4);ok(g.body.computable===false&&g.body.stale.length===3&&/obsoleto/i.test(g.body.reason),"STALE_BLOOD_GAS_NOT_COMPUTABLE");
 // 4c) Auditoría C-02 — pH de hace 1 h con pCO₂ de hace 20 h: extracciones distintas, no computable
 const p5=crypto.randomUUID();await resAt(phys,p5,"PH","7.30",hoursAgo(1));await resAt(phys,p5,"BICARBONATE","12",hoursAgo(1));await resAt(phys,p5,"PCO2","26",hoursAgo(20));
 g=await get(phys,p5);ok(g.body.computable===false&&/extracciones distintas/i.test(g.body.reason),"DIFFERENT_DRAWS_NOT_COMPUTABLE");
 // 4d) ...pero la MISMA muestra (specimenId) sí es coherente aunque la captura se haya espaciado
 const p6=crypto.randomUUID();const specimenId=crypto.randomUUID();
 await resAt(phys,p6,"PH","7.30",hoursAgo(1),{specimenId});await resAt(phys,p6,"BICARBONATE","12",hoursAgo(3),{specimenId});await resAt(phys,p6,"PCO2","26",hoursAgo(5),{specimenId});
 g=await get(phys,p6);ok(g.body.computable===true&&g.body.primary==="METABOLIC_ACIDOSIS","SAME_SPECIMEN_IS_COHERENT");
 // 4e) pCO₂ en kPa se convierte (3.47 kPa = 26 mmHg) y un pH imposible se RECHAZA al capturarlo
 const p7=crypto.randomUUID();await resAt(phys,p7,"PH","7.30",hoursAgo(1));await resAt(phys,p7,"BICARBONATE","12",hoursAgo(1),{unit:"mmol/L"});await resAt(phys,p7,"PCO2","3.47",hoursAgo(1),{unit:"kPa"});
 g=await get(phys,p7);ok(g.body.computable===true&&g.body.expectedPco2===26,"KPA_CONVERTED_TO_MMHG");
 ok(await resAt(phys,p7,"PH","74",hoursAgo(1))===400,"IMPLAUSIBLE_PH_REJECTED_400");
 // 5) sin scope patient:read -> 403
 const noScope=tok(["result:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
