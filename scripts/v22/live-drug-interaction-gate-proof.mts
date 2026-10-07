// EPIC AX — Evidencia física: no prescribir un fármaco con interacción MAJOR con uno ya activo. vs Neon.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const act=await import("../../apps/web/app/api/v1/medications/[medicationId]/activation/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["medication:propose","medication:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
// Contrato de la remediación (auditoría C-03/C-05, lote 1): con barreras NO verificables (paciente sintético sin edad, peso o
// eGFR) PRESCRIBE responde 428 hasta que el médico confirma y justifica. Las barreras BLOQUEADAS siguen devolviendo 403.
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const drug={dose:"5mg",route:"VO",frequency:"c/24h"};
async function propose(t:string,pat:string,drugCode:string){const id=crypto.randomUUID();await meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:pat,drugCode,...drug,occurredAt:ISO})}));return id;}
const B=(t:string,v:number)=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...ACK})});
async function activate(t:string,drugCode:string,pat:string){const id=await propose(t,pat,drugCode);await rx.POST(new Request("http://l/",B(t,1)),MP(id));await act.POST(new Request("http://l/",B(t,2)),MP(id));return id;}
try{
 const phys=tok();await registerPhysicianCredentials(phys);
 // 1) warfarina activa -> prescribir ibuprofeno (anticoagulante + AINE) = MAJOR -> BLOQUEADO
 const p1=crypto.randomUUID();await ensurePatientIn(TA,p1); /* L-07 */await activate(phys,"warfarina-5",p1);
 const ib=await propose(phys,p1,"ibuprofeno-400");
 let r:Response=await rx.POST(new Request("http://l/",B(phys,1)),MP(ib));ok(r.status===403&&(await r.json()).error.code==="SAFETY_BLOCKED","WARFARIN_NSAID_BLOCKED_403");
 // 2) enalapril activo -> espironolactona (IECA + ahorrador K) = MAJOR -> BLOQUEADO
 const p2=crypto.randomUUID();await ensurePatientIn(TA,p2); /* L-07 */await activate(phys,"enalapril-10",p2);
 const sp=await propose(phys,p2,"espironolactona-25");
 r=await rx.POST(new Request("http://l/",B(phys,1)),MP(sp));ok(r.status===403,"ACEI_KSPARING_BLOCKED_403");
 // 3) sin interacción: metformina activa -> amoxicilina PERMITIDO
 const p3=crypto.randomUUID();await ensurePatientIn(TA,p3); /* L-07 */await activate(phys,"metformina-850",p3);
 const am=await propose(phys,p3,"amoxicilina-500");
 r=await rx.POST(new Request("http://l/",B(phys,1)),MP(am));ok(r.status===201,"NO_INTERACTION_ALLOWED_201");
 // 4) control: ibuprofeno sin anticoagulante activo (otro paciente) -> PERMITIDO
 const p4=crypto.randomUUID();await ensurePatientIn(TA,p4); /* L-07 */const ib2=await propose(phys,p4,"ibuprofeno-400");
 r=await rx.POST(new Request("http://l/",B(phys,1)),MP(ib2));ok(r.status===201,"NSAID_ALONE_ALLOWED_201");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
