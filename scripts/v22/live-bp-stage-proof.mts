// EPIC BT — Evidencia física: estadificación ACC/AHA de la última presión arterial del paciente. vs Neon.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const vit=await import("../../apps/web/app/api/v1/vitals/route");
const bs=await import("../../apps/web/app/api/v1/patients/[patientId]/bp-stage/route");
const vitAm=await import("../../apps/web/app/api/v1/vitals/[vitalId]/amendment/route");
const vitErr=await import("../../apps/web/app/api/v1/vitals/[vitalId]/error-mark/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["vital:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function bp(t:string,p:string,v:string){await vit.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType:"BP",value:v,unit:"mmHg",occurredAt:at()})}));}
async function get(t:string,p:string){const r=await bs.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) 145/92 -> STAGE_2
 const p1=crypto.randomUUID();await ensurePatientIn(TA,p1); /* L-07 */await bp(phys,p1,"145/92");
 let g=await get(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.stage==="STAGE_2","STAGE_2");
 // 2) usa la MÁS RECIENTE: nueva 118/76 -> NORMAL
 await bp(phys,p1,"118/76");g=await get(phys,p1);ok(g.body.stage==="NORMAL","USES_LATEST_BP");
 // 3) crisis 190/100
 const p2=crypto.randomUUID();await ensurePatientIn(TA,p2); /* L-07 */await bp(phys,p2,"190/100");
 g=await get(phys,p2);ok(g.body.stage==="CRISIS","CRISIS");
 // 4) sin presión registrada -> no computable
 const p3=crypto.randomUUID();await ensurePatientIn(TA,p3); /* L-07 */g=await get(phys,p3);ok(g.body.computable===false,"NO_BP_NOT_COMPUTABLE");
 // 5) R03-16: en un NIÑO no se estadifica con los cortes de adulto (requiere percentiles por edad/sexo/talla)
 const p4=crypto.randomUUID();await ensurePatientIn(TA,p4,{birthDate:new Date(Date.now()-6*365.25*86400000).toISOString().slice(0,10)});await bp(phys,p4,"118/76");
 g=await get(phys,p4);ok(g.body.computable===false&&g.body.applicable===false&&g.body.reasonCode==="PEDIATRIC_PERCENTILE_REQUIRED","PEDIATRIC_NOT_STAGED");
 ok(g.body.systolic===118&&g.body.diastolic===76,"PEDIATRIC_STILL_REPORTS_VALUES");
 // 6) R03-11: una toma ANULADA (ENTERED_IN_ERROR) deja de ser "la última"
 const p5=crypto.randomUUID();await ensurePatientIn(TA,p5);
 await bp(phys,p5,"118/76");const vid=crypto.randomUUID();
 await vit.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:vid,patientId:p5,vitalType:"BP",value:"190/100",unit:"mmHg",occurredAt:at()})}));
 g=await get(phys,p5);ok(g.body.stage==="CRISIS","LATEST_BEFORE_VOID");
 const del=await vitErr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"Toma de otro paciente",occurredAt:at()})}),{params:Promise.resolve({vitalId:vid})});
 ok(del.status===201,"VOID_ACCEPTED");
 g=await get(phys,p5);ok(g.body.stage==="NORMAL"&&g.body.systolic===118,"VOIDED_VITAL_NOT_USED");
 // 7) R03-11: una ENMIENDA sí se usa (el valor corregido, no el original)
 const p6=crypto.randomUUID();await ensurePatientIn(TA,p6);const vid2=crypto.randomUUID();
 await vit.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:vid2,patientId:p6,vitalType:"BP",value:"190/100",unit:"mmHg",occurredAt:at()})}));
 g=await get(phys,p6);ok(g.body.stage==="CRISIS","AMEND_BEFORE");
 const am=await vitAm.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({value:"118/76",unit:"mmHg",reason:"Error de transcripción",occurredAt:at()})}),{params:Promise.resolve({vitalId:vid2})});
 ok(am.status===201,"AMEND_ACCEPTED");
 g=await get(phys,p6);ok(g.body.stage==="NORMAL","AMENDED_VALUE_USED");
 // 8) sin scope patient:read -> 403
 const noScope=tok(["vital:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
