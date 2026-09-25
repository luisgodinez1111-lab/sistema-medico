// EPIC AH — Evidencia física del triage (arribar/iniciar/clasificar/re-clasificar/cerrar/LWBS) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const tg=await import("../../apps/web/app/api/v1/triage/route");
const st=await import("../../apps/web/app/api/v1/triage/[triageId]/start/route");
const as=await import("../../apps/web/app/api/v1/triage/[triageId]/assessment/route");
const cl=await import("../../apps/web/app/api/v1/triage/[triageId]/closure/route");
const lw=await import("../../apps/web/app/api/v1/triage/[triageId]/lwbs/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["triage:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({triageId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await tg.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({triageId:id,patientId:await freshPatient(TA),chiefComplaint:"Dolor torácico",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
// Auditoría R02b (R2B-019, lote 16): esta prueba enviaba `{acuity:3}` y `{acuity:2}` —el entero tecleado que el hallazgo
// describe— y comprobaba solo el 201. Ahora envía los DISCRIMINADORES del algoritmo y comprueba que el nivel que devuelve el
// servidor es el que el algoritmo ESI produce para esos discriminadores, incluido el punto de decisión. Un cambio en el árbol
// que altere un nivel rompe esta prueba, que es lo que antes no podía pasar.
//
// Discriminadores de un adulto (edad en meses) sin banderas de los puntos A/B, para ejercitar el punto C y el punto D.
const ADULTO={ageMonths:480,requiresLifeSavingIntervention:false,highRiskSituation:false,
 newConfusionLethargyDisorientation:false,severeDistress:false};
try{
 const nurse=tok(TA);
 // arribar -> iniciar -> clasificar (punto C, dos recursos -> ESI-3) -> re-clasificar (punto B, alto riesgo -> ESI-2) -> cerrar
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="WAITING","ARRIVE_201");
 r=await st.POST(new Request("http://l/",B(nurse,1)),PP(id));ok(r.status===201&&(await r.json()).state==="IN_TRIAGE","START_201");
 r=await as.POST(new Request("http://l/",B(nurse,2,{...ADULTO,predictedResources:2,heartRate:80,respiratoryRate:16,spo2:98})),PP(id));
 let j=await r.json() as{state:string;acuity:number;decisionPoint:string;upgradeConsidered:boolean;reassessDueAt:string|null};
 ok(r.status===201&&j.state==="TRIAGED","TRIAGE_201");
 ok(j.acuity===3&&j.decisionPoint==="C","TRIAGE_LEVEL_DERIVED_FROM_RESOURCES:"+j.acuity+j.decisionPoint);
 ok(j.reassessDueAt!==null,"TRIAGE_HAS_REASSESSMENT_DEADLINE");
 r=await as.POST(new Request("http://l/",B(nurse,3,{...ADULTO,highRiskSituation:true,predictedResources:2})),PP(id));
 j=await r.json() as typeof j;
 ok(r.status===201&&j.state==="TRIAGED","RETRIAGE_201");
 ok(j.acuity===2&&j.decisionPoint==="B","RETRIAGE_HIGH_RISK_IS_LEVEL_2:"+j.acuity+j.decisionPoint);
 r=await cl.POST(new Request("http://l/",B(nurse,4)),PP(id));ok(r.status===201&&(await r.json()).state==="CLOSED","CLOSE_201");
 // SM: clasificar tras cerrar (terminal) -> 409
 r=await as.POST(new Request("http://l/",B(nurse,5,{...ADULTO,requiresLifeSavingIntervention:true,predictedResources:0})),PP(id));ok(r.status===409,"TRIAGE_AFTER_CLOSE_409");
 // EL ALGORITMO, ejercitado contra la ruta real: cada punto de decisión produce su nivel.
 {
  const caso=async(v:number,body:Record<string,unknown>)=>{
   const t=await mk(nurse);
   await st.POST(new Request("http://l/",B(nurse,1)),PP(t.id));
   const res=await as.POST(new Request("http://l/",B(nurse,2,body)),PP(t.id));
   void v;return await res.json() as{acuity:number;decisionPoint:string;upgradeConsidered:boolean;vitalsMissing:string[]};
  };
  const a1=await caso(2,{...ADULTO,requiresLifeSavingIntervention:true,predictedResources:0});
  ok(a1.acuity===1&&a1.decisionPoint==="A","POINT_A_IS_LEVEL_1:"+a1.acuity+a1.decisionPoint);
  const b2=await caso(2,{...ADULTO,painScore:8,predictedResources:0});
  ok(b2.acuity===2&&b2.decisionPoint==="B","SEVERE_PAIN_IS_LEVEL_2:"+b2.acuity+b2.decisionPoint);
  const c5=await caso(2,{...ADULTO,predictedResources:0});
  ok(c5.acuity===5&&c5.decisionPoint==="C","NO_RESOURCES_IS_LEVEL_5:"+c5.acuity+c5.decisionPoint);
  const c4=await caso(2,{...ADULTO,predictedResources:1});
  ok(c4.acuity===4,"ONE_RESOURCE_IS_LEVEL_4:"+c4.acuity);
  // PUNTO D: el mismo caso que dio 3, con signos vitales en zona de peligro, sugiere subir a 2 sin subirlo en silencio.
  const d3=await caso(2,{...ADULTO,predictedResources:3,heartRate:130,respiratoryRate:16,spo2:98});
  ok(d3.acuity===3&&d3.decisionPoint==="D"&&d3.upgradeConsidered===true,"DANGER_ZONE_VITALS_SUGGEST_UPGRADE:"+d3.acuity+d3.decisionPoint+d3.upgradeConsidered);
  // Un signo vital NO aportado se reporta como faltante, no se asume normal.
  const sinVitales=await caso(2,{...ADULTO,predictedResources:3});
  ok(sinVitales.vitalsMissing.length===3,"MISSING_VITALS_ARE_REPORTED:"+sinVitales.vitalsMissing.join(","));
  // Un cuerpo sin los discriminadores es 422: ya no se puede clasificar mandando solo un número.
  const viejo=await mk(nurse);
  await st.POST(new Request("http://l/",B(nurse,1)),PP(viejo.id));
  const rv=await as.POST(new Request("http://l/",B(nurse,2,{acuity:2})),PP(viejo.id));
  ok(rv.status===400,"BARE_ACUITY_NUMBER_REJECTED_400:"+rv.status);
 }
 // SM: clasificar sin iniciar -> 409
 const two=await mk(nurse);
 r=await as.POST(new Request("http://l/",B(nurse,1,{...ADULTO,predictedResources:1})),PP(two.id));ok(r.status===409,"TRIAGE_WITHOUT_START_409");
 // LWBS desde WAITING
 const three=await mk(nurse);
 r=await lw.POST(new Request("http://l/",B(nurse,1,{reason:"Paciente se retiró"})),PP(three.id));ok(r.status===201&&(await r.json()).state==="LWBS","LWBS_201");
 // cross-tenant -> 404
 const nurseB=tok(TB);
 r=await st.POST(new Request("http://l/",B(nurseB,1)),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope triage:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await tg.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({triageId:crypto.randomUUID(),patientId:await freshPatient(TA),chiefComplaint:"x",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
