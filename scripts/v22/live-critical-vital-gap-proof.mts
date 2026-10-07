// EPIC AO — Evidencia física: un signo vital CRÍTICO aflora como care gap HIGH y desaparece al corregirse. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const vt=await import("../../apps/web/app/api/v1/vitals/route");
const am=await import("../../apps/web/app/api/v1/vitals/[vitalId]/amendment/route");
const gaps=await import("../../apps/web/app/api/v1/patients/[patientId]/care-gaps/route");
const wl=await import("../../apps/web/app/api/v1/worklist/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:read","vital:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["NURSE"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const TP=(id:string)=>({params:Promise.resolve({patientId:id})});const VP=(id:string)=>({params:Promise.resolve({vitalId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const{result,ok,fin}=libro();
async function careGapCodes(t:string,pat:string){const r=await gaps.GET(new Request("http://l/",{headers:H(t)}),TP(pat));return((await r.json()).gaps||[]).map((g:{code:string})=>g.code);}
try{
 const nurse=tok();const pat=crypto.randomUUID();await ensurePatientIn(TA,pat); /* L-07 */const vid=crypto.randomUUID();
 // registrar una presión en crisis hipertensiva (CRÍTICA) para el paciente
 let r:Response=await vt.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:vid,patientId:pat,vitalType:"BP",value:"190/125",unit:"mmHg",occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).status==="CRITICAL","VITAL_RECORDED_CRITICAL");
 // aparece como care gap HIGH en el chart del paciente
 ok((await careGapCodes(nurse,pat)).includes("VITAL_CRITICAL"),"CARE_GAP_PRESENT");
 // aparece en el worklist poblacional del panel
 r=await wl.GET(new Request("http://l/",{headers:H(nurse)}));
 const panel=(await r.json()).gaps as {patientId:string;code:string}[];
 ok(panel.some(g=>g.patientId===pat&&g.code==="VITAL_CRITICAL"),"PANEL_HAS_CRITICAL_VITAL");
 // enmendar a un valor normal -> el pendiente desaparece
 r=await am.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({value:"120/80",unit:"mmHg",reason:"Reverificado",occurredAt:ISO})}),VP(vid));
 ok(r.status===201&&(await r.json()).status==="NORMAL","VITAL_AMENDED_NORMAL");
 ok(!(await careGapCodes(nurse,pat)).includes("VITAL_CRITICAL"),"CARE_GAP_CLEARED");
}catch(e){fin(e);}
fin();
