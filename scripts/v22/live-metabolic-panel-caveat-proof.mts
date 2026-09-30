// Hallazgo D9 del lote 11 (+ revisión adversarial F7) — Evidencia física: la advertencia del panel metabólico dice lo que se
// calculó y sale de la fuente única del dominio (anionGapCaveat); la albúmina usada para corregir la brecha aparece en la
// procedencia aunque no se haya calculado el calcio corregido; y una brecha BAJA ya corregida por albúmina no se atribuye a
// hipoalbuminemia. vs base desechable.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET; // R11-07: lo resuelve el prólogo común (_live-env), nunca un literal
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const lab:Record<string,unknown>=await import("../../packages/lab-derivations/src");
// Fuente única de la advertencia; si el dominio no la exporta, los checks que la exigen fallan (no lanzan).
const caveatOf=typeof lab.anionGapCaveat==="function"?lab.anionGapCaveat as (ag:{albuminCorrected:boolean}|undefined)=>string:undefined;
const resR=await import("../../apps/web/app/api/v1/results/route");
const mp=await import("../../apps/web/app/api/v1/patients/[patientId]/metabolic-panel/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["result:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function res(t:string,p:string,analyte:string,value:string){const r=await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte,value,unit:canonicalUnitOf(analyte)??"n/a",occurredAt:at()})}));if(r.status!==201)throw new Error(`RESULT_${analyte}_${r.status}`);}
async function panel(t:string,p:string){const r=await mp.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
const analytes=(b:{inputs?:{analyte:string}[]})=>(b.inputs??[]).map(i=>i.analyte);
try{
 const phys=tok();
 // A) Brecha corregida por albúmina (sin calcio): advertencia coherente y la albúmina en la procedencia.
 const a=crypto.randomUUID();await ensurePatientIn(TA,a);
 for(const[k,v]of[["SODIUM","130"],["CHLORIDE","100"],["BICARBONATE","10"],["ALBUMIN","2.0"]]as const)await res(phys,a,k,v);
 const g=await panel(phys,a);
 ok(g.status===200&&g.body.anionGap?.albuminCorrected===true&&g.body.anionGap.value===25,"ANION_GAP_ALBUMIN_CORRECTED");
 ok(!String(g.body.caveat).includes("SIN corrección")&&!String(g.body.caveat).includes("SIN corregir")&&String(g.body.caveat).includes("corregida por albúmina"),"CAVEAT_MATCHES_CORRECTED_GAP");
 ok(g.body.correctedCalcium===null&&analytes(g.body).includes("ALBUMIN"),"ALBUMIN_IN_PROVENANCE_WITHOUT_CALCIUM");
 // B) Sin albúmina: brecha cruda y la advertencia lo declara.
 const b=crypto.randomUUID();await ensurePatientIn(TA,b);
 for(const[k,v]of[["SODIUM","130"],["CHLORIDE","100"],["BICARBONATE","10"]]as const)await res(phys,b,k,v);
 const u=await panel(phys,b);
 ok(u.status===200&&u.body.anionGap?.albuminCorrected===false&&String(u.body.caveat).includes("SIN corregir por albúmina")&&!analytes(u.body).includes("ALBUMIN"),"CAVEAT_DECLARES_UNCORRECTED_GAP");
 // Una sola fuente de verdad: el texto de la ruta ES el del dominio en los tres estados (corregida, sin corregir, sin brecha).
 const e=crypto.randomUUID();await ensurePatientIn(TA,e);await res(phys,e,"SODIUM","140");
 const n=await panel(phys,e);
 ok(n.status===200&&n.body.anionGap===null&&!!caveatOf&&g.body.caveat===caveatOf({albuminCorrected:true})&&u.body.caveat===caveatOf({albuminCorrected:false})&&n.body.caveat===caveatOf(undefined)&&String(n.body.caveat).includes("Sin brecha aniónica"),"CAVEAT_FROM_DOMAIN_SOURCE");
 // C) F7: brecha BAJA ya corregida por albúmina (140−115−24 = 1; albúmina 4.5 -> −0.3): no se atribuye a hipoalbuminemia.
 const c=crypto.randomUUID();await ensurePatientIn(TA,c);
 for(const[k,v]of[["SODIUM","140"],["CHLORIDE","115"],["BICARBONATE","24"],["ALBUMIN","4.5"]]as const)await res(phys,c,k,v);
 const l=await panel(phys,c);const li=String(l.body.anionGap?.interpretation);
 ok(l.status===200&&l.body.anionGap?.status==="LOW"&&l.body.anionGap.albuminCorrected===true&&!/hipoalbuminemia/.test(li)&&li.includes("pese a la corrección por albúmina"),"LOW_CORRECTED_GAP_NOT_HYPOALBUMINEMIA");
 // Sin albúmina, la misma brecha baja SÍ puede deberse a hipoalbuminemia y se dice.
 const d=crypto.randomUUID();await ensurePatientIn(TA,d);
 for(const[k,v]of[["SODIUM","140"],["CHLORIDE","115"],["BICARBONATE","24"]]as const)await res(phys,d,k,v);
 const lu=await panel(phys,d);
 // Revisión del porte (2122aa9): el sufijo «sin corregir» contiene «hipoalbuminemia» en toda brecha sin corregir; se exige la
 // causa propia de la rama baja, antes del sufijo.
 const lui=String(lu.body.anionGap?.interpretation);
 ok(lu.status===200&&lu.body.anionGap?.status==="LOW"&&lu.body.anionGap.albuminCorrected===false&&/^Brecha aniónica baja \(hipoalbuminemia, paraproteínas\) \(sin corregir por albúmina/.test(lui)&&!lui.includes("pese a la corrección"),"LOW_UNCORRECTED_GAP_MENTIONS_HYPOALBUMINEMIA");
 // La interpretación cambió con F7: la ruta declara la versión del dominio (fuente única), que ya no es la «2» previa a F7.
 const alg=lab.METABOLIC_DERIVATIONS_ALGORITHM as {id:string;version:string}|undefined;
 ok(!!alg&&[g,u,n,l,lu].every(r=>JSON.stringify(r.body.algorithm)===JSON.stringify(alg))&&alg.id==="METABOLIC-DERIVATIONS"&&alg.version!=="2","ALGORITHM_VERSION_FROM_DOMAIN_AFTER_F7");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
