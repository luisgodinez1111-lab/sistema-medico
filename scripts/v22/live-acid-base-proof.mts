// EPIC BX — Evidencia física: interpretación ácido-base (trastorno primario + Winters) desde pH/pCO2/HCO3. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const resR=await import("../../apps/web/app/api/v1/results/route");
const ab=await import("../../apps/web/app/api/v1/patients/[patientId]/acid-base/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["result:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.now()-3_600_000/* reloj RELATIVO: las calculadoras rechazan datos obsoletos; una fecha fija haría caducar la prueba */;const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const{result,ok,fin}=libro();
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,unit:canonicalUnitOf(a)??"mg/dL",occurredAt:at()})}));}
// Variante con control total de la captura (hora, unidad, muestra) para probar la guarda de entradas verificadas.
async function resAt(t:string,p:string,a:string,v:string,occurredAt:string,extra:Record<string,unknown>={}){const r=await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,unit:canonicalUnitOf(a)??"mg/dL",occurredAt,...extra})}));return r.status;}
const hoursAgo=(h:number)=>new Date(Date.now()-h*3_600_000).toISOString();
async function get(t:string,p:string,q="?specimen=ARTERIAL"){const r=await ab.GET(new Request("http://l/acid-base"+q,{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) acidosis metabólica con compensación adecuada: pH 7.30, HCO3 12, pCO2 26 (esperado 26)
 const p1=crypto.randomUUID();await ensurePatientIn(TA,p1); /* L-07 */
 for(const[a,v]of[["PH","7.30"],["BICARBONATE","12"],["PCO2","26"]]as const)await res(phys,p1,a,v);
 let g=await get(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(g.body.primary==="METABOLIC_ACIDOSIS"&&g.body.expectedPco2===26,"METABOLIC_ACIDOSIS_WINTERS");
 ok(/adecuada/i.test(g.body.compensation),"COMPENSATION_ADEQUATE");
 // 2) usa la gasometría MÁS RECIENTE: nueva toma con pCO₂ 40 (y el pH que le corresponde, 7.10: subir el pCO₂ sin mover
 //    el pH es físicamente imposible y desde R03-07 el panel se rechazaría) -> acidosis respiratoria concurrente.
 await res(phys,p1,"PCO2","40");await res(phys,p1,"PH","7.10");
 g=await get(phys,p1);ok(/respiratoria concurrente/i.test(g.body.compensation),"MIXED_ON_LATEST_PCO2");
 // 3) acidosis respiratoria: pH 7.28, pCO2 60, HCO3 24
 const p2=crypto.randomUUID();await ensurePatientIn(TA,p2); /* L-07 */
 for(const[a,v]of[["PH","7.33"],["PCO2","62"],["BICARBONATE","32"]]as const)await res(phys,p2,a,v);
 g=await get(phys,p2);ok(g.body.primary==="RESPIRATORY_ACIDOSIS","RESPIRATORY_ACIDOSIS");
 // 3b) R03-06: el caso del anexo. EPOC retenedor (pH 7.33 / pCO₂ 62 / HCO₃ 32). Antes NO había `compensation` para los
 //     trastornos respiratorios, así que el sistema no distinguía la descompensación aguda del estado crónico compensado.
 ok(Array.isArray(g.body.scenarios)&&g.body.scenarios.length===2,"BOTH_CHRONICITY_SCENARIOS");
 ok(g.body.scenarios.find((x:{chronicity:string})=>x.chronicity==="ACUTE").expectedHco3===26.2,"ACUTE_EXPECTED_HCO3");
 ok(g.body.scenarios.find((x:{chronicity:string})=>x.chronicity==="CHRONIC").matches===true,"MEASURED_MATCHES_CHRONIC");
 ok(/CRÓNICA/.test(g.body.compensation),"CHRONIC_PATTERN_NAMED");
 let gd=await get(phys,p2,"?specimen=ARTERIAL&chronicity=ACUTE");
 ok(gd.body.expectedHco3===26.2&&/Alcalosis metabólica concurrente/.test(gd.body.compensation),"DECLARED_ACUTE_SINGLE_VERDICT");
 // 3c) R03-07: de una muestra VENOSA no se juzga la compensación respiratoria
 gd=await get(phys,p2,"?specimen=VENOUS");
 ok(gd.body.computable===true&&gd.body.compensationAssessed===false&&gd.body.expectedHco3===null,"VENOUS_NO_COMPENSATION");
 ok(/VENOSA/.test(gd.body.interpretation),"VENOUS_DECLARED");
 // 3d) R03-07: sin declarar la muestra no se interpreta nada
 gd=await get(phys,p2,"");
 ok(gd.body.computable===false&&gd.body.reasonCode==="SPECIMEN_REQUIRED","SPECIMEN_REQUIRED");
 // 4) falta un analito -> no computable
 const p3=crypto.randomUUID();await ensurePatientIn(TA,p3); /* L-07 */await res(phys,p3,"PH","7.4");await res(phys,p3,"PCO2","40");
 g=await get(phys,p3);ok(g.body.computable===false&&g.body.missing.includes("BICARBONATE")&&/bicarbonato/i.test(g.body.reason),"MISSING_ANALYTE");
 // 4b) Auditoría C-02 — gasometría OBSOLETA (3 días): no computable, con el analito en `stale`
 const p4=crypto.randomUUID();await ensurePatientIn(TA,p4); /* L-07 */for(const[a,v]of[["PH","7.30"],["BICARBONATE","12"],["PCO2","26"]]as const)await resAt(phys,p4,a,v,hoursAgo(72));
 g=await get(phys,p4);ok(g.body.computable===false&&g.body.stale.length===3&&/obsoleto/i.test(g.body.reason),"STALE_BLOOD_GAS_NOT_COMPUTABLE");
 // 4c) Auditoría C-02 — pH de hace 1 h con pCO₂ de hace 20 h: extracciones distintas, no computable
 const p5=crypto.randomUUID();await ensurePatientIn(TA,p5); /* L-07 */await resAt(phys,p5,"PH","7.30",hoursAgo(1));await resAt(phys,p5,"BICARBONATE","12",hoursAgo(1));await resAt(phys,p5,"PCO2","26",hoursAgo(20));
 g=await get(phys,p5);ok(g.body.computable===false&&/extracciones distintas/i.test(g.body.reason),"DIFFERENT_DRAWS_NOT_COMPUTABLE");
 // 4d) ...pero la MISMA muestra (specimenId) sí es coherente aunque la captura se haya espaciado
 const p6=crypto.randomUUID();await ensurePatientIn(TA,p6); /* L-07 */const specimenId=crypto.randomUUID();
 await resAt(phys,p6,"PH","7.30",hoursAgo(1),{specimenId});await resAt(phys,p6,"BICARBONATE","12",hoursAgo(3),{specimenId});await resAt(phys,p6,"PCO2","26",hoursAgo(5),{specimenId});
 g=await get(phys,p6);ok(g.body.computable===true&&g.body.primary==="METABOLIC_ACIDOSIS","SAME_SPECIMEN_IS_COHERENT");
 // 4e) pCO₂ en kPa se convierte (3.47 kPa = 26 mmHg) y un pH imposible se RECHAZA al capturarlo
 const p7=crypto.randomUUID();await ensurePatientIn(TA,p7); /* L-07 */await resAt(phys,p7,"PH","7.30",hoursAgo(1));await resAt(phys,p7,"BICARBONATE","12",hoursAgo(1),{unit:"mmol/L"});await resAt(phys,p7,"PCO2","3.47",hoursAgo(1),{unit:"kPa"});
 g=await get(phys,p7);ok(g.body.computable===true&&g.body.expectedPco2===26,"KPA_CONVERTED_TO_MMHG");
 ok(await resAt(phys,p7,"PH","74",hoursAgo(1))===400,"IMPLAUSIBLE_PH_REJECTED_400");
 // 4f) R03-07: un panel internamente INCOHERENTE se rechaza. (7.40, 40, 5) es físicamente imposible —Henderson-
 //      Hasselbalch da 6.72— y antes se clasificaba sin objeción. Cada valor pasa la plausibilidad por separado.
 const p8=crypto.randomUUID();await ensurePatientIn(TA,p8);
 await resAt(phys,p8,"PH","7.40",hoursAgo(1));await resAt(phys,p8,"PCO2","40",hoursAgo(1));await resAt(phys,p8,"BICARBONATE","5",hoursAgo(1));
 g=await get(phys,p8);ok(g.body.computable===false&&g.body.reasonCode==="GAS_PANEL_INCONSISTENT","INCOHERENT_PANEL_REJECTED");
 ok(/transposición/.test(g.body.reason),"INCOHERENCE_EXPLAINS_TRANSPOSITION");
 // 4g) R03-05: con sodio y cloro coherentes, la acidosis metabólica se BIFURCA y se calcula el delta-delta
 const p9=crypto.randomUUID();await ensurePatientIn(TA,p9);
 for(const[a,v]of[["PH","7.20"],["PCO2","25"],["BICARBONATE","10"],["SODIUM","140"],["CHLORIDE","106"]]as const)await resAt(phys,p9,a,v,hoursAgo(1));
 g=await get(phys,p9);
 ok(g.body.anionGap!==null&&g.body.anionGap.value===24,"ANION_GAP_IN_ANALYSIS");
 ok(g.body.anionGapBranch==="HIGH_AG"&&/cetoacidosis/.test(g.body.interpretation),"HIGH_AG_BRANCH");
 ok(g.body.deltaRatio===0.86&&/pura/.test(g.body.deltaInterpretation),"DELTA_DELTA_COMPUTED");
 // 4h) R03-05: con albúmina baja, la brecha se corrige (Figge) y una acidosis enmascarada aparece
 const p10=crypto.randomUUID();await ensurePatientIn(TA,p10);
 for(const[a,v]of[["PH","7.20"],["PCO2","25"],["BICARBONATE","10"],["SODIUM","140"],["CHLORIDE","118"],["ALBUMIN","2.0"]]as const)await resAt(phys,p10,a,v,hoursAgo(1));
 g=await get(phys,p10);
 ok(g.body.anionGap.raw===12&&g.body.anionGap.albuminCorrected===true&&g.body.anionGap.value===17,"ALBUMIN_CORRECTED_GAP");
 ok(g.body.anionGapBranch==="HIGH_AG"&&/corregida por albúmina/.test(g.body.interpretation),"MASKED_HIGH_AG_REVEALED");
 // 5) sin scope patient:read -> 403
 const noScope=tok(["result:write"]);g=await get(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
