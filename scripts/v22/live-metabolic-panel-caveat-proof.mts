// Hallazgo D9 del lote 11 — Evidencia física: la advertencia del panel metabólico dice lo que se calculó. Antes devolvía la
// brecha aniónica CORREGIDA por albúmina junto al texto fijo «SIN corrección por albúmina», y la albúmina usada para
// corregirla no aparecía en la procedencia si no se había calculado también el calcio corregido. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"d9-caveat-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const resR=await import("../../apps/web/app/api/v1/results/route");
const mp=await import("../../apps/web/app/api/v1/patients/[patientId]/metabolic-panel/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["result:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function res(t:string,p:string,analyte:string,value:string){const r=await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte,value,occurredAt:at()})}));if(r.status!==201)throw new Error(`RESULT_${analyte}_${r.status}`);}
async function panel(t:string,p:string){const r=await mp.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
const analytes=(b:{inputs?:{analyte:string}[]})=>(b.inputs??[]).map(i=>i.analyte);
try{
 const phys=tok();
 // A) Brecha corregida por albúmina (sin calcio): advertencia coherente y la albúmina en la procedencia.
 const a=crypto.randomUUID();await ensurePatientIn(TA,a);
 for(const[k,v]of[["SODIUM","130"],["CHLORIDE","100"],["BICARBONATE","10"],["ALBUMIN","2.0"]]as const)await res(phys,a,k,v);
 const g=await panel(phys,a);
 ok(g.status===200&&g.body.anionGap?.albuminCorrected===true&&g.body.anionGap.value===25,"ANION_GAP_ALBUMIN_CORRECTED");
 ok(!String(g.body.caveat).includes("SIN corrección")&&String(g.body.caveat).includes("corregida por albúmina"),"CAVEAT_MATCHES_CORRECTED_GAP");
 ok(g.body.correctedCalcium===null&&analytes(g.body).includes("ALBUMIN"),"ALBUMIN_IN_PROVENANCE_WITHOUT_CALCIUM");
 // B) Sin albúmina: brecha cruda y la advertencia lo declara.
 const b=crypto.randomUUID();await ensurePatientIn(TA,b);
 for(const[k,v]of[["SODIUM","130"],["CHLORIDE","100"],["BICARBONATE","10"]]as const)await res(phys,b,k,v);
 const u=await panel(phys,b);
 ok(u.status===200&&u.body.anionGap?.albuminCorrected===false&&String(u.body.caveat).includes("SIN corrección por albúmina")&&!analytes(u.body).includes("ALBUMIN"),"CAVEAT_DECLARES_UNCORRECTED_GAP");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
