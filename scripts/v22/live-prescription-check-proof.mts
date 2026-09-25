// EPIC CG — Evidencia física: dry-run de prescripción segura (panel 3) — compone las barreras (alergia +
// reactividad cruzada, dosis-techo, ajuste renal por eGFR) SIN escribir. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const alR=await import("../../apps/web/app/api/v1/allergies/route");
const pcR=await import("../../apps/web/app/api/v1/patients/[patientId]/prescription-check/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write","allergy:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000/* reloj RELATIVO: las calculadoras rechazan datos obsoletos; una fecha fija haría caducar la prueba */;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number,sex:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:sex,occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,unit:canonicalUnitOf(a)??"mg/dL",occurredAt:at()})}));}
async function allergy(t:string,p:string,s:string){await alR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:crypto.randomUUID(),patientId:p,substance:s,severity:"SEVERE",reaction:"anafilaxia",occurredAt:at()})}));}
async function check(t:string,p:string,drug:string,dose:string,route:string,freq:string){const r=await pcR.POST(new Request("http://l/",{method:"POST",headers:H(t),body:JSON.stringify({drug,dose,route,frequency:freq})}),PP(p));return{status:r.status,body:await r.json()};}
const find=(b:{checks:{id:string;status:string}[]},id:string)=>b.checks.find(c=>c.id===id);
try{
 const phys=tok();
 const p=crypto.randomUUID();await reg(phys,p,65,"MALE");
 await allergy(phys,p,"penicilina");
 await res(phys,p,"CREATININE","2.0"); // eGFR bajo (~37) -> ajuste renal en metformina

 // 1) amoxicilina con alergia a penicilina -> BLOQUEO por reactividad cruzada beta-lactámico
 const a=await check(phys,p,"amoxicilina","500mg","Oral","c/8h");
 ok(a.status===200,"CHECK_200");
 ok(find(a.body,"allergy")?.status==="BLOCK","ALLERGY_CROSS_REACTIVITY_BLOCK");
 ok(a.body.verdict==="BLOCK","VERDICT_BLOCK_ON_ALLERGY");

 // 2) metformina con eGFR bajo -> ajuste renal (WARN o BLOCK), NO OK
 const m=await check(phys,p,"metformina","850mg","Oral","c/12h");
 ok(find(m.body,"renal")?.status!=="OK","RENAL_ADJUSTMENT_FLAGGED");
 ok(m.body.verdict!=="OK","VERDICT_NOT_OK_LOW_EGFR");

 // 3) paracetamol -> sin conflicto de alergia; renal OK; veredicto no bloqueado
 const c=await check(phys,p,"paracetamol","500mg","Oral","c/8h");
 ok(find(c.body,"allergy")?.status==="OK","PARACETAMOL_NO_ALLERGY");
 ok(c.body.verdict!=="BLOCK","PARACETAMOL_NOT_BLOCKED");
 ok(!!c.body.indications,"INDICATIONS_PRESENT");

 // 4) Auditoría C-03 — fármaco fuera de catálogo: NINGUNA barrera dependiente del catálogo se da por buena. Antes "WARN" con
 //    el resto en OK; ahora NOT_EVALUATED explícito, confirmación requerida y ninguna barrera clínica en "OK".
 const u=await check(phys,p,"medicamentox","1 tab","Oral","c/24h");
 ok(u.status===200&&find(u.body,"catalog")?.status==="NOT_EVALUATED","UNKNOWN_DRUG_NOT_EVALUATED");
 ok(u.body.requiresAcknowledgement===true&&u.body.verdict==="WARN","UNKNOWN_DRUG_REQUIRES_ACK");
 ok(["interaction","duplicate","contraindication","doseCeiling","renal"].every(id=>find(u.body,id)?.status==="NOT_EVALUATED"),"UNKNOWN_DRUG_NO_FALSE_OK");
 ok(Array.isArray(u.body.notEvaluated)&&u.body.notEvaluated.includes("catalog"),"NOT_EVALUATED_LISTED");

 // 5) sin scope -> 403
 const noScope=await check(tok(["result:write"]),p,"paracetamol","500mg","Oral","c/8h");
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
