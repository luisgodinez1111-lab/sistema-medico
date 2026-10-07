// EPIC BN — Evidencia física: derivaciones multi-analito (anion gap, calcio corregido) desde los resultados
// del paciente. Cross-analito. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const resR=await import("../../apps/web/app/api/v1/results/route");
const mp=await import("../../apps/web/app/api/v1/patients/[patientId]/metabolic-panel/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["result:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000/* reloj RELATIVO: las calculadoras rechazan datos obsoletos; una fecha fija haría caducar la prueba */;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const{result,ok,fin}=libro();
async function res(t:string,p:string,analyte:string,value:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte,value,unit:canonicalUnitOf(analyte)??"n/a",occurredAt:at()})}));}
async function panel(t:string,p:string){const r=await mp.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) acidosis de brecha aumentada + hipocalcemia enmascarada + hiperglucemia (Na corregido, osmolalidad)
 const p1=crypto.randomUUID();await ensurePatientIn(TA,p1); /* L-07 */
 for(const[a,v]of[["SODIUM","130"],["CHLORIDE","100"],["BICARBONATE","10"],["CALCIUM","8.0"],["ALBUMIN","2.0"],["GLUCOSE","600"],["BUN","40"]]as const)await res(phys,p1,a,v);
 let g=await panel(phys,p1);ok(g.status===200,"PANEL_200");
 // C-22: brecha cruda 20 (130-100-10) corregida por albúmina 2.0 -> 20 + 2.5·(4-2) = 25 (la hipoalbuminemia la subestimaba)
 ok(g.body.anionGap&&g.body.anionGap.raw===20&&g.body.anionGap.value===25&&g.body.anionGap.albuminCorrected===true&&g.body.anionGap.status==="HIGH","ANION_GAP_HIGH_20_CORRECTED_25");
 ok(g.body.correctedCalcium&&g.body.correctedCalcium.corrected===9.6,"CORRECTED_CA_9_6");
 ok(g.body.correctedSodium&&g.body.correctedSodium.corrected===138,"CORRECTED_NA_138"); // 130+1.6*5
 ok(g.body.osmolality&&g.body.osmolality.status==="HIGH","OSMOLALITY_HIGH");
 ok(Array.isArray(g.body.missing)&&g.body.missing.length===0,"NOTHING_MISSING");
 // 2) usa el valor MÁS RECIENTE: nuevo bicarbonato normal cambia el anion gap
 await res(phys,p1,"BICARBONATE","24");g=await panel(phys,p1);
 ok(g.body.anionGap.raw===6&&g.body.anionGap.value===11,"USES_LATEST_HCO3"); // cruda 130-100-24=6; corregida por albúmina 2.0 -> 11
 // 3) analitos faltantes -> derivación null + reportada en missing
 const p2=crypto.randomUUID();await ensurePatientIn(TA,p2); /* L-07 */await res(phys,p2,"SODIUM","140");
 g=await panel(phys,p2);ok(g.body.anionGap===null&&g.body.correctedCalcium===null&&g.body.correctedSodium===null&&g.body.osmolality===null&&g.body.missing.length===4,"MISSING_REPORTED");
 // 4) aislamiento por paciente: p2 no ve los analitos de p1
 ok(g.body.correctedCalcium===null,"PER_PATIENT_ISOLATION");
 // 5) sin scope patient:read -> 403
 const noScope=tok(["result:write"]);const g3=await panel(noScope,p1);ok(g3.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
