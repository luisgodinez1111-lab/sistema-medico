// EPIC AL — Evidencia física de la sesión de diálisis (agendar/iniciar/interrumpir/reanudar/completar) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const ds=await import("../../apps/web/app/api/v1/dialysis-sessions/route");
const st=await import("../../apps/web/app/api/v1/dialysis-sessions/[dialysisId]/start/route");
const it=await import("../../apps/web/app/api/v1/dialysis-sessions/[dialysisId]/interruption/route");
const re=await import("../../apps/web/app/api/v1/dialysis-sessions/[dialysisId]/resumption/route");
const co=await import("../../apps/web/app/api/v1/dialysis-sessions/[dialysisId]/completion/route");
const ns=await import("../../apps/web/app/api/v1/dialysis-sessions/[dialysisId]/no-show/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["dialysis:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({dialysisId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string,extra:Record<string,unknown>={}){const id=crypto.randomUUID();const r=await ds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({dialysisId:id,patientId:await freshPatient(TA),modality:"HEMODIALYSIS",accessType:"FISTULA",prescribedMinutes:240,...extra,occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const nurse=tok(TA);
 // Auditoría R02b (R2B-020, lote 19): antes esta prueba agendaba, iniciaba, interrumpía («Hipotensión» en texto libre),
 // reanudaba y completaba SIN UN SOLO DATO de la terapia, y comprobaba los 201. Es la prueba que dejaba pasar el hallazgo:
 // una sesión de diálisis sin peso, sin urea, sin duración y sin ultrafiltración era «correcta». Ahora la prescripción, las
 // medidas y el cálculo de adecuación se ejercitan de punta a punta.
 const START=(w:number,urea?:number)=>({preWeightKg:w,...(urea===undefined?{}:{preUreaMgDl:urea})});
 // agendar -> iniciar -> interrumpir -> reanudar -> completar
 let{id,r}=await mk(nurse,{dryWeightKg:70});ok(r.status===201&&(await r.json()).state==="SCHEDULED","SCHEDULE_201");
 r=await st.POST(new Request("http://l/",B(nurse,1,START(73.4,120))),PP(id));ok(r.status===201&&(await r.json()).state==="IN_SESSION","START_201");
 r=await it.POST(new Request("http://l/",B(nurse,2,{cause:"HIPOTENSION",reason:"Hipotensión sintomática",systolic:82,diastolic:48})),PP(id));ok(r.status===201&&(await r.json()).state==="INTERRUPTED","INTERRUPT_201");
 r=await re.POST(new Request("http://l/",B(nurse,3)),PP(id));ok(r.status===201&&(await r.json()).state==="IN_SESSION","RESUME_201");
 r=await co.POST(new Request("http://l/",B(nurse,4,{postWeightKg:70.2,durationMinutes:240,postUreaMgDl:32})),PP(id));
 {
  const j=await r.json() as{state:string;adequacy:{spKtV:number|null;urrPercent:number|null;ultrafiltrationL:number;ultrafiltrationRateMlKgH:number|null;deltaFromDryWeightKg:number|null;shortfallMinutes:number;warnings:string[];formula:string}};
  ok(r.status===201&&j.state==="COMPLETED","COMPLETE_201");
  // LA ADECUACIÓN SE CALCULA, y con la fórmula declarada: antes no existía ni el campo.
  ok(j.adequacy.spKtV!==null&&j.adequacy.spKtV>1.2,"KTV_CALCULATED_AND_ADEQUATE:"+String(j.adequacy.spKtV));
  ok(j.adequacy.urrPercent!==null&&Math.abs(j.adequacy.urrPercent-73.3)<0.2,"URR_CALCULATED:"+String(j.adequacy.urrPercent));
  ok(Math.abs(j.adequacy.ultrafiltrationL-3.2)<0.001,"ULTRAFILTRATION_FROM_WEIGHTS:"+String(j.adequacy.ultrafiltrationL));
  ok(j.adequacy.ultrafiltrationRateMlKgH!==null&&Math.abs(j.adequacy.ultrafiltrationRateMlKgH-11.4)<0.2,"UF_RATE_NORMALIZED:"+String(j.adequacy.ultrafiltrationRateMlKgH));
  ok(j.adequacy.deltaFromDryWeightKg!==null&&Math.abs(j.adequacy.deltaFromDryWeightKg-0.2)<0.001,"DRY_WEIGHT_COMPARED:"+String(j.adequacy.deltaFromDryWeightKg));
  ok(j.adequacy.shortfallMinutes===0,"PRESCRIBED_TIME_MET");
  ok(j.adequacy.formula.includes("Daugirdas"),"FORMULA_DECLARED:"+j.adequacy.formula);
 }
 // SM: iniciar tras completar (terminal) -> 409
 r=await st.POST(new Request("http://l/",B(nurse,5,START(73))),PP(id));ok(r.status===409,"START_AFTER_COMPLETE_409");
 // SM: completar sin iniciar -> 409
 const two=await mk(nurse);
 r=await co.POST(new Request("http://l/",B(nurse,1,{postWeightKg:70,durationMinutes:240})),PP(two.id));ok(r.status===409,"COMPLETE_WITHOUT_START_409");

 // UNA SESIÓN INSUFICIENTE Y PELIGROSA se detecta, que es para lo que sirven los dos números.
 {
  const mala=await mk(nurse,{dryWeightKg:60});
  await st.POST(new Request("http://l/",B(nurse,1,START(65,120))),PP(mala.id));
  // Sesión acortada (120 de 240 min), urea post alta (Kt/V bajo) y 5 kg retirados en 2 h (UF muy alta).
  const rr=await co.POST(new Request("http://l/",B(nurse,2,{postWeightKg:60,durationMinutes:120,postUreaMgDl:78})),PP(mala.id));
  const j=await rr.json() as{adequacy:{spKtV:number|null;shortfallMinutes:number;warnings:string[]}};
  const w=j.adequacy.warnings.join(" ");
  ok(j.adequacy.shortfallMinutes===120,"SHORTFALL_DETECTED:"+String(j.adequacy.shortfallMinutes));
  ok(/SESION_ACORTADA/.test(w),"SHORTENED_SESSION_WARNED");
  ok(/KTV_BAJO/.test(w),"LOW_KTV_WARNED:"+String(j.adequacy.spKtV));
  ok(/UF_RATE_ALTA/.test(w),"HIGH_UF_RATE_WARNED");
 }
 // Y una sesión SIN urea no inventa un Kt/V: lo declara faltante.
 {
  const sinUrea=await mk(nurse);
  await st.POST(new Request("http://l/",B(nurse,1,START(72))),PP(sinUrea.id));
  const rr=await co.POST(new Request("http://l/",B(nurse,2,{postWeightKg:70,durationMinutes:240})),PP(sinUrea.id));
  const j=await rr.json() as{adequacy:{spKtV:number|null;missing:string[]}};
  ok(j.adequacy.spKtV===null,"NO_UREA_NO_KTV");
  ok(j.adequacy.missing.includes("preUreaMgDl")&&j.adequacy.missing.includes("postUreaMgDl"),"MISSING_UREA_DECLARED:"+j.adequacy.missing.join(","));
 }
 // Cerrar una sesión que nunca se inició es 409 por la MÁQUINA DE ESTADOS, y ese es el error correcto: «no puedes completar
 // sin iniciar» explica lo que pasó mejor que «falta el peso pre». El peso pre ya no puede faltar en una sesión iniciada
 // desde el lote 19 —`StartBody` lo exige—, así que la precondición que lo comprueba cubre solo los streams anteriores.
 {
  const sinIniciar=await mk(nurse);
  const rr=await co.POST(new Request("http://l/",B(nurse,1,{postWeightKg:70,durationMinutes:240})),PP(sinIniciar.id));
  ok(rr.status===409,"CANNOT_CLOSE_UNSTARTED_SESSION:"+rr.status);
  // Y una sesión no puede iniciarse sin peso pre: la puerta lo exige.
  const sinPeso=await co.POST(new Request("http://l/",B(nurse,1,{durationMinutes:240})),PP(sinIniciar.id));
  void sinPeso;
  const inicioSinPeso=await st.POST(new Request("http://l/",B(nurse,1,{})),PP(sinIniciar.id));
  ok(inicioSinPeso.status===400,"CANNOT_START_WITHOUT_PRE_WEIGHT:"+inicioSinPeso.status);
 }
 // no-show desde SCHEDULED
 const three=await mk(nurse);
 r=await ns.POST(new Request("http://l/",B(nurse,1)),PP(three.id));ok(r.status===201&&(await r.json()).state==="NO_SHOW","NOSHOW_201");
 // cross-tenant -> 404
 const nurseB=tok(TB);
 r=await st.POST(new Request("http://l/",B(nurseB,1,START(70))),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope dialysis:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await ds.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({dialysisId:crypto.randomUUID(),patientId:await freshPatient(TA),modality:"PERITONEAL",accessType:"PERITONEAL_CATHETER",prescribedMinutes:240,occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
