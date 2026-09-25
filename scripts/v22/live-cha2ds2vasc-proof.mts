// EPIC BQ — Evidencia física: CHA₂DS₂-VASc desde la lista de problemas + demografía -> indicación de anticoagulación. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const prob=await import("../../apps/web/app/api/v1/problems/route");
const ch=await import("../../apps/web/app/api/v1/patients/[patientId]/cha2ds2vasc/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","problem:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number,sex:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:sex,occurredAt:at()})}));}
async function dx(t:string,p:string,code:string){await prob.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code,occurredAt:at()})}));}
async function get(t:string,p:string){const r=await ch.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) hombre 80 (edad 2) con FA(I48.9)+HTA(I10)+DM(E11)+IC(I50.9) = 2+1+1+1 = 5 -> HIGH, aplicable
 const p1=crypto.randomUUID();await reg(phys,p1,80,"MALE");
 for(const c of["I48.9","I10","E11","I50.9"])await dx(phys,p1,c);
 let g=await get(phys,p1);ok(g.status===200,"COMPUTED_200");
 ok(g.body.score===5&&g.body.risk==="HIGH","SCORE_5_HIGH");
 ok(g.body.applicable===true,"AFIB_APPLICABLE");
 ok(/recomendada/i.test(g.body.recommendation),"ANTICOAG_RECOMMENDED");
 // R03-03: ya NO se publica un porcentaje de riesgo anual (la tabla anterior no era monótona: 9.6% con 7 puntos y 6.7%
 // con 8). Y toda recomendación de anticoagular advierte que el riesgo HEMORRÁGICO no fue evaluado.
 ok(g.body.annualStrokeRiskPct===undefined,"NO_INVENTED_ANNUAL_RISK");
 ok(g.body.bleedingRiskAssessed===false&&/hemorr/i.test(g.body.recommendation),"BLEEDING_RISK_CAVEAT");
 // 2) hombre 50 sin factores -> score 0, LOW
 const p2=crypto.randomUUID();await reg(phys,p2,50,"MALE");
 g=await get(phys,p2);ok(g.body.score===0&&g.body.applicable===false,"SCORE_0_NOT_APPLICABLE");
 // 3) R03-04: sin FA registrada NO se emite recomendación terapéutica (antes venía "Anticoagulación oral recomendada"
 //    junto a applicable:false; una recomendación al lado de un booleano se lee como recomendación).
 ok(g.body.applicable===false&&/fibrilaci/i.test(g.body.reason),"NO_AFIB_REASON");
 ok(g.body.recommendation===undefined&&g.body.risk===undefined,"NO_AFIB_NO_RECOMMENDATION");
 // 4) Decisión D1 (ESC 2024, CHA₂DS₂-VA): el SEXO NO SUMA. Mujer 70 con HTA -> edad(1)+HTA(1)=2 -> HIGH.
 //    Esta prueba fijaba antes un 3 (incluía el punto por sexo), que es exactamente lo que la guía eliminó.
 const p3=crypto.randomUUID();await reg(phys,p3,70,"FEMALE");await dx(phys,p3,"I48.9");await dx(phys,p3,"I10");
 g=await get(phys,p3);ok(g.body.score===2&&g.body.risk==="HIGH","FEMALE_SCORE_2_HIGH_NO_SEX_POINT");
 ok(g.body.algorithm?.id==="CHA2DS2-VA-ESC-2024","ALGORITHM_IS_CHA2DS2_VA");
 ok(/modificador de riesgo, NO suma puntos/.test(String(g.body.sexModifier??"")),"SEX_REPORTED_AS_MODIFIER");
 // Y el par: el MISMO perfil en un varón da el MISMO puntaje y la MISMA conducta. Era imposible con VASc.
 const p3b=crypto.randomUUID();await reg(phys,p3b,70,"MALE");await dx(phys,p3b,"I48.9");await dx(phys,p3b,"I10");
 const gb=await get(phys,p3b);
 ok(gb.body.score===g.body.score&&gb.body.risk===g.body.risk,"SAME_SCORE_AND_RISK_REGARDLESS_OF_SEX");
 // 5) R03-17: el criterio S₂ (ictus previo, 2 puntos) por fin es ALCANZABLE: antes ningún código de ictus existía en el
 //    catálogo, así que el criterio de más peso de la escala no podía cumplirse nunca. Z86.7 (antecedente) también cuenta.
 const p4=crypto.randomUUID();await reg(phys,p4,50,"MALE");await dx(phys,p4,"I48.9");await dx(phys,p4,"I63.9");
 g=await get(phys,p4);ok(g.body.components.stroke===2&&g.body.score===2,"STROKE_CRITERION_REACHABLE");
 const p5=crypto.randomUUID();await reg(phys,p5,50,"MALE");await dx(phys,p5,"I48.9");await dx(phys,p5,"Z86.7");
 g=await get(phys,p5);ok(g.body.components.stroke===2,"HISTORY_Z86_7_COUNTS");
 // 6) R03-17: cardiopatía hipertensiva (I11.0) cuenta como HTA y como insuficiencia cardiaca
 const p6=crypto.randomUUID();await reg(phys,p6,50,"MALE");await dx(phys,p6,"I48.9");await dx(phys,p6,"I11.0");
 g=await get(phys,p6);ok(g.body.components.hypertension===1&&g.body.components.chf===1,"HYPERTENSIVE_HEART_DISEASE_COUNTS");
 ok(g.body.valueSetVersion.length>0,"VERSIONED_VALUE_SET");
 // 7) paciente no registrado -> 404
 g=await get(phys,crypto.randomUUID());ok(g.status===404,"UNREGISTERED_404");
 // 8) sin scope patient:read -> 403
 const noScope=tok(["problem:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
