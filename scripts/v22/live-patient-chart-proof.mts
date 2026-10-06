// EXPEDIENTE VIVO — evidencia física: GET /patients/:id/chart hidrata los módulos del expediente con la historia REAL del
// paciente (problemas, alergias, resultados…), cada fila con su VERSIÓN (para que la UI pueda transicionar lo leído).
// Antes el front arrancaba estos módulos en [] y solo mostraba lo creado en la sesión. vs base desechable con RLS.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const prob=await import("../../apps/web/app/api/v1/problems/route");
const alR=await import("../../apps/web/app/api/v1/allergies/route");
const medR=await import("../../apps/web/app/api/v1/medications/route");
const ordR=await import("../../apps/web/app/api/v1/orders/route");
const chartR=await import("../../apps/web/app/api/v1/patients/[patientId]/chart/route");
const oblR=await import("../../apps/web/app/api/v1/obligations/route");
const refR=await import("../../apps/web/app/api/v1/referrals/route");
const apptR=await import("../../apps/web/app/api/v1/appointments/route");
const consR=await import("../../apps/web/app/api/v1/consents/route");
const cplR=await import("../../apps/web/app/api/v1/care-plans/route");
const resoR=await import("../../apps/web/app/api/v1/problems/[problemId]/resolution/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write","problem:write","problem:resolve","allergy:write","medication:propose","order:write","obligation:write","referral:write","appointment:write","consent:write","careplan:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number,sex:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:sex,occurredAt:at()})}));}
async function res(t:string,p:string,a:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:a,value:v,unit:canonicalUnitOf(a)??"mg/dL",occurredAt:at()})}));}
async function dx(t:string,p:string,c:string,id:string=crypto.randomUUID(),enc?:string){await prob.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:id,patientId:p,code:c,...(enc?{encounterId:enc}:{}),occurredAt:at()})}));return id;}
async function med(t:string,p:string,drugCode:string,problemId?:string,enc?:string){await medR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:crypto.randomUUID(),patientId:p,drugCode,dose:"500 mg",route:"oral",frequency:"c/8h",...(problemId?{problemId}:{}),...(enc?{encounterId:enc}:{}),occurredAt:at()})}));}
async function order(t:string,p:string,detail:string,problemId?:string,enc?:string){await ordR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({orderId:crypto.randomUUID(),patientId:p,orderType:"LAB",detail,...(problemId?{problemId}:{}),...(enc?{encounterId:enc}:{}),occurredAt:at()})}));}
async function allergy(t:string,p:string,s:string){await alR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:crypto.randomUUID(),patientId:p,substance:s,severity:"MODERATE",reaction:"rash",occurredAt:at()})}));}
async function get(t:string,p:string){const r=await chartR.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
const hasVersion=(a:Array<{version?:unknown}>)=>a.every(x=>typeof x.version==="number"&&(x.version as number)>=1);
try{
 const phys=tok();
 const p=crypto.randomUUID();await reg(phys,p,54,"FEMALE");
 const ENC=crypto.randomUUID(); // contexto del acto: la "visita" en que se documenta DM + su med + su orden
 const dm=crypto.randomUUID();await dx(phys,p,"E11.9",dm,ENC); // captura el id del problema DM para enlazar
 for(const c of["I10","N18.3"])await dx(phys,p,c);
 await res(phys,p,"CREATININE","1.3");
 await res(phys,p,"HBA1C","7.1");
 await allergy(phys,p,"penicilina");
 // POMR: una medicación y una orden ENLAZADAS al problema DM (E11.9) y al ACTO (ENC); otra orden sin enlazar.
 await med(phys,p,"metformina",dm,ENC);
 await order(phys,p,"HbA1c de control",dm,ENC);
 await order(phys,p,"Perfil de lípidos");
 // Coordinación + Plan — un agregado de cada tipo para el paciente, para comprobar que el chart los HIDRATA (antes salían
 // vacíos: islas, y una obligación que bloquea la firma no tenía fila accionable).
 await oblR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:crypto.randomUUID(),patientId:p,ownerId:crypto.randomUUID(),dueAt:at(),kind:"CRITICAL_RESULT_REVIEW",priority:"URGENT",occurredAt:at()})}));
 await refR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({referralId:crypto.randomUUID(),patientId:p,specialty:"Cardiología",reason:"Soplo",occurredAt:at()})}));
 await apptR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({appointmentId:crypto.randomUUID(),patientId:p,startAt:at(),reason:"Control DM2",occurredAt:at()})}));
 await consR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({consentId:crypto.randomUUID(),patientId:p,scopeType:"PROCEDURE",documentRef:"consent-doc-1",occurredAt:at()})}));
 await cplR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({carePlanId:crypto.randomUUID(),patientId:p,category:"DIABETES",goal:"HbA1c < 7% en 3 meses",occurredAt:at()})}));
 const g=await get(phys,p);
 ok(g.status===200,"CHART_200");
 // El expediente llega HIDRATADO con la historia real (no vacío), y cada fila trae su versión (If-Match).
 ok(Array.isArray(g.body.problems)&&g.body.problems.length===3,"PROBLEMS_3");
 ok(g.body.problems.every((x:{id?:unknown;label?:unknown;state?:unknown})=>!!x.id&&!!x.label&&!!x.state),"PROBLEM_SHAPE");
 ok(hasVersion(g.body.problems),"PROBLEM_VERSION");
 ok(Array.isArray(g.body.allergies)&&g.body.allergies.length===1,"ALLERGIES_1");
 ok(String(g.body.allergies[0].label).toLowerCase().includes("penicilina"),"ALLERGY_LABEL");
 ok(hasVersion(g.body.allergies),"ALLERGY_VERSION");
 ok(Array.isArray(g.body.results)&&g.body.results.length===2,"RESULTS_2");
 ok(hasVersion(g.body.results),"RESULT_VERSION");
 for(const k of["medications","vitals","immunizations","orders"])ok(Array.isArray(g.body[k]),`${k.toUpperCase()}_ARRAY`);
 // POMR — la medicación y la orden ENLAZADAS traen el problema (E11.9); la orden sin enlazar no.
 ok(g.body.medications.length===1&&hasVersion(g.body.medications),"MEDICATIONS_1");
 ok(String(g.body.medications[0].problemLabel??"").includes("E11.9"),"MED_LINKED_PROBLEM");
 ok(g.body.orders.length===2&&hasVersion(g.body.orders),"ORDERS_2");
 ok(g.body.orders.some((o:{problemLabel?:unknown})=>String(o.problemLabel??"").includes("E11.9")),"ORDER_LINKED_PROBLEM");
 ok(g.body.orders.some((o:{problemLabel?:unknown})=>!o.problemLabel),"ORDER_UNLINKED_OK");
 // CONTEXTO DEL ACTO: el problema DM, su medicación y su orden comparten el MISMO encounterId → "la visita" es reconstruible.
 ok(g.body.problems.find((x:{label:string;encounterId?:string})=>x.label.includes("E11.9"))?.encounterId===ENC,"PROBLEM_ACT_CONTEXT");
 ok(g.body.medications[0].encounterId===ENC,"MED_ACT_CONTEXT");
 ok(g.body.orders.filter((o:{encounterId?:string})=>o.encounterId===ENC).length===1,"ORDER_ACT_CONTEXT");
 // Coordinación + Plan HIDRATADOS con forma accionable (id/label/state) y versión (If-Match para transicionar).
 // Interconsultas/citas/consentimientos/plan: exactamente 1 (el que creamos). Obligaciones: ≥1 — además de la nuestra,
 // los resultados ANORMALES (p.ej. HbA1c 7.1) auto-crean su obligación de seguimiento, así que puede haber más.
 for(const[k,st,exact] of [["referrals","REQUESTED",true],["appointments","SCHEDULED",true],["consents","DRAFTED",true],["carePlans","PROPOSED",true],["obligations","OPEN",false]] as [string,string,boolean][]){
  const arr=g.body[k] as Array<{id?:unknown;label?:unknown;state?:unknown;version?:unknown}>;
  ok(Array.isArray(arr)&&(exact?arr.length===1:arr.length>=1),`${k.toUpperCase()}_${exact?"1":"GE1"}`);
  ok(arr.every(x=>!!x.id&&!!x.label&&!!x.state)&&arr.some(x=>x.state===st),`${k.toUpperCase()}_SHAPE`);
  ok(hasVersion(arr),`${k.toUpperCase()}_VERSION`);
 }
 // FUGA CROSS-PACIENTE de la etiqueta diagnóstica (auditoría Lote 1): una med de un paciente que referencia el problemId de
 // OTRO paciente del MISMO tenant no debe mostrar su CIE-10. El write-side acepta `problemId` sin validar pertenencia (solo
 // formato uuid), así que la barrera está en el read-model: `probLink` ahora acota por patientId. Antes el chart de A pintaba
 // el diagnóstico de B como etiqueta de la med de A.
 const pA=crypto.randomUUID(),pB=crypto.randomUUID();
 await reg(phys,pA,50,"MALE");await reg(phys,pB,50,"FEMALE");
 const probB=await dx(phys,pB,"C50.9"); // problema DISTINTIVO de B (no existe en A)
 await med(phys,pA,"metformina",probB); // med de A que referencia el problema de B (problemId ajeno)
 const gA=await get(phys,pA);
 ok(gA.body.medications.length===1,"XP_MED_PRESENT");
 ok(!String(gA.body.medications[0].problemLabel??"").includes("C50.9"),"XP_NO_CROSS_PATIENT_PROBLEM_LABEL");
 // Auditoría clínica multiespecialidad (06-oct-2026) — LAS FECHAS, CONTRA LA BASE.
 //
 // Las filas del expediente imprimían `v{version}` en el sitio donde iba la fecha. Ocho especialistas coincidieron en que un
 // dato clínico sin fecha no se puede valorar: «alergia a penicilina» sin el año, o «metformina» sin saber desde cuándo.
 // Aquí se comprueba que las dos fechas LLEGAN DE LA BASE y que significan lo que dicen, no que el tipo las declare.
 const conFechas=(arr:Array<Record<string,unknown>>)=>arr.length>0&&arr.every(x=>
  typeof x["createdAt"]==="string"&&!Number.isNaN(Date.parse(String(x["createdAt"])))&&
  typeof x["at"]==="string"&&!Number.isNaN(Date.parse(String(x["at"]))));
 // `conFechas` exige que el módulo TENGA filas: comprobar `every` sobre un array vacío pasa siempre y no mide nada —es la
 // forma de guardarraíl que esta auditoría lleva meses encontrando. Se listan los módulos que ESTE escenario puebla; los que
 // no (signos vitales y vacunas, que este guion no crea) se miden en sus propias pruebas en vivo.
 for(const k of ["problems","allergies","medications","orders","results","referrals","appointments","consents","carePlans","obligations"])
  ok(conFechas(g.body[k] as Array<Record<string,unknown>>),`FECHAS_${k.toUpperCase()}`);
 // `createdAt` es el NACIMIENTO del dato y `at` su último cambio: para un dato que nadie tocó coinciden.
 const alg=(g.body.allergies as Array<Record<string,string>>)[0]!;
 ok(alg["createdAt"]===alg["at"],"ALERGIA_INTACTA_MISMA_FECHA");
 // Y para uno que SÍ cambió, `at` es posterior: se resuelve un problema y su última fecha avanza sin mover la de alta.
 const probDm=(g.body.problems as Array<Record<string,string>>).find(x=>x["label"]?.includes("E11.9"))!;
 const resuelto=await resoR.POST(new Request("http://l/",{method:"POST",
  headers:H(phys,{"idempotency-key":idem(),"if-match":String(probDm["version"])}),
  body:JSON.stringify({note:"Cuadro resuelto",occurredAt:at()})}),{params:Promise.resolve({problemId:probDm["id"]!})});
 ok(resuelto.status===201,`PROBLEMA_RESUELTO_${resuelto.status}`);
 const g4=await get(phys,p);
 const probDm2=(g4.body.problems as Array<Record<string,string>>).find(x=>x["id"]===probDm["id"])!;
 ok(probDm2["createdAt"]===probDm["createdAt"],"LA_FECHA_DE_ALTA_NO_SE_MUEVE");
 ok(Date.parse(probDm2["at"]!)>=Date.parse(probDm2["createdAt"]!),"LA_FECHA_DE_CAMBIO_AVANZA");
 ok(probDm2["at"]!==probDm2["createdAt"],"SON_DOS_FECHAS_DISTINTAS_CUANDO_EL_DATO_CAMBIO");

 // Aislamiento: otro paciente no ve esta historia.
 const p2=crypto.randomUUID();await reg(phys,p2,30,"MALE");const g2=await get(phys,p2);
 ok(g2.body.problems.length===0&&g2.body.allergies.length===0&&g2.body.obligations.length===0&&g2.body.carePlans.length===0,"OTHER_PATIENT_EMPTY");
 // Sin scope de lectura -> 403.
 const noScope=tok(["result:write"]);const g3=await get(noScope,p);ok(g3.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
