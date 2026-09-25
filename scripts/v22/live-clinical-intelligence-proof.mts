// EPIC BS — Evidencia física: resumen de inteligencia clínica determinista, priorizado por severidad, desde
// vitales + labs + problemas del paciente. Integra los CDS de la sesión. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const prob=await import("../../apps/web/app/api/v1/problems/route");
const vit=await import("../../apps/web/app/api/v1/vitals/route");
const ci=await import("../../apps/web/app/api/v1/patients/[patientId]/clinical-intelligence/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write","problem:write","vital:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const U:Record<string,string>={WEIGHT:"kg",HEIGHT:"cm",BP:"mmHg",HR:"lpm",RESP:"rpm",SPO2:"%",TEMP:"C"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number,sex:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:sex,occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,unit:canonicalUnitOf(a)??"mg/dL",occurredAt:at()})}));}
async function dx(t:string,p:string,c:string){await prob.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code:c,occurredAt:at()})}));}
async function vital(t:string,p:string,vt:string,v:string){await vit.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType:vt,value:v,unit:U[vt]??"u",occurredAt:at()})}));}
async function get(t:string,p:string){const r=await ci.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // paciente complejo: 76a MALE, FA+HTA+DM, creatinina alta (ERC), HbA1c mala, IMC obeso, NEWS2 alto
 const p1=crypto.randomUUID();await reg(phys,p1,76,"MALE");
 for(const c of["I48.9","I10","E11"])await dx(phys,p1,c);
 await res(phys,p1,"CREATININE","3.0");   // ERC avanzada
 await res(phys,p1,"HBA1C","9.5");         // mal control (diabético)
 for(const[a,v]of[["WEIGHT","100"],["HEIGHT","170"],["RESP","24"],["SPO2","91"],["TEMP","39.2"],["BP","95/60"],["HR","125"]]as const)await vital(phys,p1,a,v);
 let g=await get(phys,p1);ok(g.status===200,"SUMMARY_200");
 const F=g.body.findings as{domain:string;severity:string}[];
 ok(Array.isArray(F)&&F.length>=5,"MULTIPLE_FINDINGS");
 ok(F[0]!.severity==="CRITICAL","CRITICAL_FIRST"); // priorizado: NEWS2 alto primero
 ok(F.some(x=>x.domain==="deterioro"&&x.severity==="CRITICAL"),"NEWS2_CRITICAL");
 ok(F.some(x=>x.domain==="renal"),"RENAL_FLAG");
 ok(F.some(x=>x.domain==="glucémico"),"GLYCEMIC_FLAG");
 ok(F.some(x=>x.domain==="anticoagulación"),"ANTICOAG_FLAG");
 ok(g.body.summary.critical>=1&&g.body.summary.total===F.length,"SUMMARY_COUNTS");
 // crisis hipertensiva -> hallazgo CRITICAL de presión (prueba el cableado de BP staging al resumen)
 const pbp=crypto.randomUUID();await reg(phys,pbp,55,"MALE");await vital(phys,pbp,"BP","190/100");
 g=await get(phys,pbp);ok(g.body.findings.some((x:{domain:string;severity:string})=>x.domain==="presión"&&x.severity==="CRITICAL"),"BP_CRISIS_FINDING");
 // paciente sano joven sin datos -> sin hallazgos
 const p2=crypto.randomUUID();await reg(phys,p2,30,"MALE");
 g=await get(phys,p2);ok(g.status===200&&g.body.findings.length===0,"HEALTHY_NO_FINDINGS"); // C-10: sin registros de vacunas NO se afirman "vencidas" en un adulto

 // Auditoría R02b (R2B-009, lote 18): UN SCORE SOSTENIDO POR DOS MEDICIONES NO ES UN SCORE.
 //
 // El filtro del agregador era `missing.length<7`: bastaba UN parámetro medido para publicar un NEWS2, y un score bajo por
 // falta de datos se leía igual que un score bajo real. Ahora, por debajo del mínimo, el hallazgo dice que NO es calculable
 // y cuántos parámetros hay; por encima, el texto declara con cuántos se calculó en vez de insinuarlo con un «+».
 {
  const pocos=crypto.randomUUID();await reg(phys,pocos,50,"FEMALE");
  await vital(phys,pocos,"HR","72"); // un solo parámetro medido de los siete
  g=await get(phys,pocos);
  const det=(g.body.findings as {domain:string;summary:string}[]).filter(x=>x.domain==="deterioro");
  ok(det.length===1&&/no calculable/i.test(det[0]!.summary),"NEWS2_ONE_PARAM_IS_NOT_A_SCORE:"+(det[0]?.summary??"(sin hallazgo)"));
  ok(/1 de 7/.test(det[0]!.summary),"NEWS2_SAYS_HOW_MANY_PARAMS:"+det[0]!.summary);

  // Con cuatro de los cinco medibles SÍ hay score, y el texto declara con cuántos parámetros se calculó.
  const cuatro=crypto.randomUUID();await reg(phys,cuatro,50,"FEMALE");
  for(const[k,v]of[["RESP","26"],["SPO2","91"],["HR","125"],["BP","95/60"]]as const)await vital(phys,cuatro,k,v);
  g=await get(phys,cuatro);
  const det2=(g.body.findings as {domain:string;summary:string}[]).filter(x=>x.domain==="deterioro");
  ok(det2.length===1&&/NEWS2 \d+\+/.test(det2[0]!.summary),"NEWS2_PARTIAL_SCORE_MARKED:"+(det2[0]?.summary??""));
  ok(/\[4 de 7 parámetros\]/.test(det2[0]!.summary),"NEWS2_PARTIAL_SCORE_SAYS_HOW_MANY:"+det2[0]!.summary);
 }
 // no registrado -> 404
 g=await get(phys,crypto.randomUUID());ok(g.status===404,"UNREGISTERED_404");
 // sin scope -> 403
 const noScope=tok(["result:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
