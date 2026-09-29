// Hallazgo D1 del lote 11 — Evidencia física: los read models de signos vitales usan el valor VIGENTE (última corrección) y
// excluyen las tomas marcadas como erróneas, igual que el fold `foldVital`. Antes un peso pediátrico capturado como 70 kg y
// corregido a 7 kg seguía dosificando con 70 (la barrera pediátrica no bloqueaba), una FC anulada seguía puntuando NEWS2 y
// el gate de firma contaba el crítico anulado pero no el corregido A crítico (AMENDED no lleva patientId). vs Neon.
// Porte a main (grupo D1-D2-SQL1): mismos checks; imports a la fachada `clinical-runtime` de main y un check más sobre el
// registro poblacional `vitalsRegistry`, que solo existe en main.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET; // R11-07: el secreto lo pone el prólogo/entorno, nunca la prueba
const{signSession}=await import("../../packages/session/src");
const{foldVital}=await import("../../packages/vital-fold/src");
const vt=await import("../../apps/web/app/api/v1/vitals/route");
const am=await import("../../apps/web/app/api/v1/vitals/[vitalId]/amendment/route");
const em=await import("../../apps/web/app/api/v1/vitals/[vitalId]/error-mark/route");
const pcR=await import("../../apps/web/app/api/v1/patients/[patientId]/prescription-check/route");
const bmiR=await import("../../apps/web/app/api/v1/patients/[patientId]/bmi/route");
const n2R=await import("../../apps/web/app/api/v1/patients/[patientId]/news2/route");
const pvR=await import("../../apps/web/app/api/v1/patients/[patientId]/vitals/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const{readAggregateEvents,latestVitalsByType,patientVitals,countOpenCriticalVitals}=await import("../../apps/web/lib/clinical-runtime");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);const SUB=crypto.randomUUID();
const tok=()=>signSession({sub:SUB,tenantId:TA,roles:["PHYSICIAN"],scopes:["patient:read","vital:read","vital:write","medication:propose","medication:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});const VP=(id:string)=>({params:Promise.resolve({vitalId:id})});
let ts=Date.now()-3_600_000;const at=()=>new Date(ts+=60_000).toISOString();const idem=()=>crypto.randomUUID();
const birth=(y:number)=>{const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);};
const ctx={tenantId:TA,actorId:SUB,actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:crypto.randomUUID()};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function rec(t:string,p:string,vitalType:string,value:string,unit:string){const vitalId=crypto.randomUUID();
 const r=await vt.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId,patientId:p,vitalType,value,unit,occurredAt:at()})}));
 return{vitalId,status:r.status,body:await r.json()};}
async function amend(t:string,v:string,value:string,unit:string,ver:number){
 const r=await am.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(ver)}),body:JSON.stringify({value,unit,reason:"Error de captura",occurredAt:at()})}),VP(v));
 return{status:r.status,body:await r.json()};}
async function voidVital(t:string,v:string,ver:number){
 const r=await em.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(ver)}),body:JSON.stringify({reason:"Paciente equivocado",occurredAt:at()})}),VP(v));
 return{status:r.status,body:await r.json()};}
async function get(mod:{GET:(r:Request,c:ReturnType<typeof PP>)=>Promise<Response>},t:string,p:string,q=""){const r=await mod.GET(new Request("http://l/"+q,{headers:H(t)}),PP(p));return await r.json();}
try{
 const phys=tok();
 // A) Niño de 5 años: peso capturado 70 kg (error de dedo) y CORREGIDO a 7 kg.
 const child=crypto.randomUUID();await ensurePatientIn(TA,child,{birthDate:birth(5),sexAtBirth:"MALE"});
 const w=await rec(phys,child,"WEIGHT","70","kg");await rec(phys,child,"HEIGHT","110","cm");
 const a=await amend(phys,w.vitalId,"7","kg",1);ok(w.status===201&&a.status===201&&a.body.state==="AMENDED","WEIGHT_AMENDED_70_TO_7");
 const fw=foldVital(await readAggregateEvents(ctx,w.vitalId));
 const latest=await latestVitalsByType(ctx,child);ok(latest["WEIGHT"]==="7"&&latest["WEIGHT"]===fw.value,"LATEST_VITALS_USE_AMENDED_VALUE");
 const hist=(await patientVitals(ctx,child)).filter(x=>x.vitalType==="WEIGHT");
 ok(hist.length===1&&hist[0]!.value==="7"&&hist[0]!.unit==="kg","HISTORY_SHOWS_AMENDED_VALUE");
 ok((await get(bmiR,phys,child)).weightKg===7,"BMI_USES_AMENDED_WEIGHT");
 const pr=await pcR.POST(new Request("http://l/",{method:"POST",headers:H(phys),body:JSON.stringify({drug:"paracetamol",dose:"500mg",route:"Oral",frequency:"c/6h"})}),PP(child));
 const pd=((await pr.json()).checks as {id:string;status:string;detail:string}[]).find(c=>c.id==="pediatricDose");
 ok(pr.status===200&&pd?.status==="BLOCK"&&pd.detail.includes("peso 7 kg"),"PEDIATRIC_DOSE_BLOCKS_ON_AMENDED_WEIGHT");
 const mr=await meds.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:crypto.randomUUID(),patientId:child,drugCode:"paracetamol",dose:"500mg",route:"VO",frequency:"c/6h",occurredAt:at()})}));
 ok(mr.status===403&&(await mr.json()).error?.code==="SAFETY_BLOCKED","MEDICATION_PROPOSE_BLOCKED_ON_AMENDED_WEIGHT");
 // B) Adulto: FC 140 (crítica) y luego MARCADA COMO ERRÓNEA: deja de existir para NEWS2, historial y últimos valores.
 const adult=crypto.randomUUID();await ensurePatientIn(TA,adult,{birthDate:birth(40),sexAtBirth:"FEMALE"});
 const hr=await rec(phys,adult,"HR","140","lpm");ok(hr.status===201&&hr.body.status==="CRITICAL","HR_140_RECORDED_CRITICAL");
 // Porte a main: la ruta NEWS2 de main solo usa las tomas cuando TODOS los signos requeridos son utilizables
 // (`used=vit.ok?vit.inputs:[]`), así que con la FC sola no puntuaría nada ni antes ni después de anularla y la
 // precondición no probaría nada. Los dos checks de NEWS2 van sobre otro adulto con el juego completo (FR, SpO2, T, PA
 // normales + la misma FC 140), para que el historial de `adult` siga teniendo SOLO la FC anulada (checks siguientes).
 const adultN=crypto.randomUUID();await ensurePatientIn(TA,adultN,{birthDate:birth(40),sexAtBirth:"FEMALE"});
 for(const[k,v,u]of[["RESP","16","rpm"],["SPO2","98","%"],["TEMP","36.8","C"],["BP","120/80","mmHg"]]as const)await rec(phys,adultN,k,v,u);
 const hrN=await rec(phys,adultN,"HR","140","lpm");
 ok(hrN.status===201&&(await get(n2R,phys,adultN,"?o2=false&avpu=A")).news2?.params?.hr===3,"NEWS2_SCORES_HR_BEFORE_VOID");
 const e=await voidVital(phys,hr.vitalId,1);ok(e.status===201&&e.body.state==="ENTERED_IN_ERROR","HR_ENTERED_IN_ERROR");
 ok(!("HR" in await latestVitalsByType(ctx,adult)),"VOIDED_VITAL_ABSENT_FROM_LATEST");
 ok((await voidVital(phys,hrN.vitalId,1)).status===201,"NEWS2_HR_ENTERED_IN_ERROR");
 const n2=(await get(n2R,phys,adultN,"?o2=false&avpu=A")).news2;ok(n2?.params?.hr===undefined&&(n2?.missing as string[]).includes("hr"),"NEWS2_IGNORES_VOIDED_HR");
 ok((await patientVitals(ctx,adult)).length===0&&(await get(pvR,phys,adult)).latest===null,"VOIDED_VITAL_ABSENT_FROM_HISTORY");
 // Porte a main: el registro poblacional de signos vitales (vitalsRegistry, solo existe en main) ya usaba el valor vigente y
 // excluía los anulados; se fija aquí que sigue diciendo lo mismo que el fold y que el historial.
 const vr=await(await vt.GET(new Request("http://l/?limit=200",{headers:H(phys)}))).json();
 const vItems=vr.items as{vitalId:string;value:string}[];
 ok(vItems.find(x=>x.vitalId===w.vitalId)?.value===fw.value&&!vItems.some(x=>x.vitalId===hr.vitalId),"VITALS_REGISTRY_CURRENT_AND_NOT_VOIDED");
 // C) Gate de firma (vitales críticos sin atender) sobre el valor VIGENTE: el anulado no cuenta, el corregido A crítico sí.
 // Un paciente por escenario: cada conteo depende solo de su propio vital.
 const g1=crypto.randomUUID();await ensurePatientIn(TA,g1,{birthDate:birth(50),sexAtBirth:"FEMALE"});
 const bp=await rec(phys,g1,"BP","190/125","mmHg");ok(bp.body.status==="CRITICAL"&&await countOpenCriticalVitals(ctx,g1)===1,"CRITICAL_GATE_COUNTS_RECORDED_CRITICAL");
 await voidVital(phys,bp.vitalId,1);ok(await countOpenCriticalVitals(ctx,g1)===0,"CRITICAL_GATE_IGNORES_VOIDED");
 const g2=crypto.randomUUID();await ensurePatientIn(TA,g2,{birthDate:birth(50),sexAtBirth:"FEMALE"});
 const bp2=await rec(phys,g2,"BP","120/80","mmHg");ok(bp2.body.status==="NORMAL"&&await countOpenCriticalVitals(ctx,g2)===0,"CRITICAL_GATE_IGNORES_NORMAL");
 const up=await amend(phys,bp2.vitalId,"190/125","mmHg",1);ok(up.body.status==="CRITICAL"&&await countOpenCriticalVitals(ctx,g2)===1,"CRITICAL_GATE_COUNTS_AMENDED_TO_CRITICAL");
 const down=await amend(phys,bp2.vitalId,"120/80","mmHg",2);ok(down.body.status==="NORMAL"&&await countOpenCriticalVitals(ctx,g2)===0,"CRITICAL_GATE_CLEARS_ON_AMEND_TO_NORMAL");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
