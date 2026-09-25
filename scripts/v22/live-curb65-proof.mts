// EPIC BZ — Evidencia física: CURB-65 desde BUN + FR/PA + edad. Cross-vertical labs+vitales+demografía. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const vit=await import("../../apps/web/app/api/v1/vitals/route");
const cb=await import("../../apps/web/app/api/v1/patients/[patientId]/curb65/route");
const prob=await import("../../apps/web/app/api/v1/problems/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write","vital:write","problem:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000/* reloj RELATIVO: las calculadoras rechazan datos obsoletos; una fecha fija haría caducar la prueba */;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const U:Record<string,string>={RESP:"rpm",BP:"mmHg"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:"MALE",occurredAt:at()})}));}
async function bun(t:string,p:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:"BUN",value:v,unit:"mg/dL",occurredAt:at()})}));}
async function vital(t:string,p:string,vt:string,v:string){await vitalAt(t,p,vt,v,at());}
async function vitalAt(t:string,p:string,vt:string,v:string,when:string){await vit.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType:vt,value:v,unit:U[vt]??"u",occurredAt:when})}));}
async function dx(t:string,p:string,code:string){await prob.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code,occurredAt:at()})}));}
async function get(t:string,p:string,q=""){const r=await cb.GET(new Request("http://l/curb65"+q,{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) R03-04: sin NEUMONÍA activa el CURB-65 NO se calcula ni recomienda (antes: "considerar ingreso" a un anciano con
 //    insuficiencia renal y sin infección). El mismo paciente, con y sin el diagnóstico, es la prueba.
 const p1=crypto.randomUUID();await reg(phys,p1,70);await bun(phys,p1,"25");await vital(phys,p1,"RESP","18");await vital(phys,p1,"BP","120/80");
 let g=await get(phys,p1);
 ok(g.status===200&&g.body.applicable===false&&g.body.reasonCode==="NO_PNEUMONIA_DIAGNOSIS","NO_PNEUMONIA_NOT_APPLICABLE");
 ok(g.body.recommendation===undefined&&g.body.score===undefined&&g.body.risk===undefined,"NO_PNEUMONIA_NO_RECOMMENDATION");
 // 2) con J18.9 (neumonía, no especificada) sí aplica. Confusión NO declarada -> RANGO, sin riesgo único (R03-18).
 await dx(phys,p1,"J18.9");
 g=await get(phys,p1);ok(g.body.applicable===true&&g.body.computable===true,"PNEUMONIA_APPLICABLE");
 ok(g.body.confusionAssessed===false&&g.body.risk===undefined&&g.body.recommendation===undefined,"NO_SINGLE_RISK_WITHOUT_CONFUSION");
 ok(g.body.scoreRange.min===2&&g.body.scoreRange.max===3,"SCORE_RANGE_2_3");
 ok(g.body.riskRange.min==="MODERATE"&&g.body.riskRange.max==="HIGH","RISK_RANGE_MODERATE_HIGH");
 ok(g.body.action==="ASSESS_CONFUSION"&&g.body.criteria.confusion===null,"ACTION_ASSESS_CONFUSION");
 // 3) declarando la confusión hay un valor único (y el puntaje sube: 3 -> HIGH, ingreso)
 g=await get(phys,p1,"?confusion=true");
 ok(g.body.confusionAssessed===true&&g.body.score===3&&g.body.risk==="HIGH","CONFUSION_TRUE_SCORE_3_HIGH");
 ok(/ingreso/i.test(g.body.recommendation)&&g.body.mortalityPct===14.5,"ADMIT_RECOMMENDED_WITH_LIM2003_MORTALITY");
 g=await get(phys,p1,"?confusion=false");ok(g.body.score===2&&g.body.risk==="MODERATE","CONFUSION_FALSE_SCORE_2");
 // 4) 40a estable con neumonía: BUN 10, FR 18, PA 120/80 -> score 0, LOW (ambulatorio)
 const p2=crypto.randomUUID();await reg(phys,p2,40);await dx(phys,p2,"J18.9");await bun(phys,p2,"10");await vital(phys,p2,"RESP","18");await vital(phys,p2,"BP","120/80");
 g=await get(phys,p2,"?confusion=false");ok(g.body.score===0&&g.body.risk==="LOW","SCORE_0_LOW");
 ok(g.body.mortalityPct===0.7,"MORTALITY_0_7_LIM2003");
 // 5) usa la PA MÁS RECIENTE: hipotensión 85/55 -> sube el score (bp+)
 await vital(phys,p2,"BP","85/55");g=await get(phys,p2,"?confusion=false");ok(g.body.criteria.bp===1&&g.body.score===1,"USES_LATEST_BP");
 // 6) falta BUN -> no computable (y el motivo estructurado lo dice)
 const p3=crypto.randomUUID();await reg(phys,p3,60);await dx(phys,p3,"J18.9");await vital(phys,p3,"RESP","18");await vital(phys,p3,"BP","120/80");
 g=await get(phys,p3);ok(g.body.computable===false&&g.body.missing.includes("BUN"),"MISSING_BUN");
 // 7) R03-11: FR y PA OBSOLETAS (más de 8 h) no deciden un ingreso hoy
 const p4=crypto.randomUUID();await reg(phys,p4,70);await dx(phys,p4,"J18.9");await bun(phys,p4,"25");
 await vitalAt(phys,p4,"RESP","32",new Date(Date.now()-30*3_600_000).toISOString());
 await vitalAt(phys,p4,"BP","120/80",new Date(Date.now()-30*3_600_000).toISOString());
 g=await get(phys,p4,"?confusion=false");ok(g.body.computable===false&&g.body.stale.length>0,"STALE_VITALS_NOT_USED");
 // 8) R03-18: menor de 16 años -> la escala no está validada (criterios pediátricos)
 const p5=crypto.randomUUID();await reg(phys,p5,6);await dx(phys,p5,"J18.9");
 g=await get(phys,p5);ok(g.body.applicable===false&&g.body.reasonCode==="BELOW_VALIDATED_AGE","PEDIATRIC_NOT_VALIDATED");
 // 9) R03-17: el value set es insensible al punto y reconoce toda la familia J12–J18 (J15.9 = neumonía bacteriana)
 const p6=crypto.randomUUID();await reg(phys,p6,70);await dx(phys,p6,"J15.9");await bun(phys,p6,"25");await vital(phys,p6,"RESP","32");await vital(phys,p6,"BP","120/80");
 g=await get(phys,p6,"?confusion=false");ok(g.body.applicable===true&&g.body.score===3&&g.body.criteria.resp===1,"J15_9_ALSO_PNEUMONIA");
 ok(g.body.valueSetVersion.length>0&&g.body.algorithm.authority.includes("Lim"),"VERSIONED_VALUE_SET_AND_AUTHORITY");
 // 10) no registrado -> 404
 g=await get(phys,crypto.randomUUID());ok(g.status===404,"UNREGISTERED_404");
 // 11) sin scope -> 403
 const noScope=tok(["result:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
