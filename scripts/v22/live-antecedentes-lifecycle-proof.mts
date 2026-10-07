// MATRIZ FUNDACIONAL — Evidencia física de los antecedentes (capturar/leer/enmendar) contra una base desechable.
// Singleton por paciente: capturar una vez (RECORDED v1), re-capturar choca (409), enmendar con If-Match (AMENDED),
// enmendar con versión vieja choca (409), enmendar sin existir es 404, aislamiento por tenant y gate de scope.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const ant=await import("../../apps/web/app/api/v1/patients/[patientId]/antecedentes/route");
const amd=await import("../../apps/web/app/api/v1/patients/[patientId]/antecedentes/amendment/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["PHYSICIAN"],scopes=["antecedentes:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(pid:string)=>({params:Promise.resolve({patientId:pid})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const CONTENT={noPatologicos:{tabaquismo:true,alcoholismo:false,toxicomanias:false,notas:"fuma 5/día"},heredofamiliares:{flags:["DIABETES","HTA"],notas:"madre DM2"}};
const CONTENT2={noPatologicos:{tabaquismo:false,alcoholismo:false,toxicomanias:false},heredofamiliares:{flags:["DIABETES"]}};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const recordReq=(t:string,body:unknown,key=idem())=>new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":key}),body:JSON.stringify(body)});
const amendReq=(t:string,v:number,body:unknown)=>new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify(body)});
try{
 const phys=tok(TA);
 const pid=await freshPatient(TA);
 // capturar (RECORDED v1)
 let r:Response=await ant.POST(recordReq(phys,{content:CONTENT,occurredAt:ISO}),PP(pid));ok(r.status===201&&(await r.json()).state==="RECORDED","RECORD_201");
 // leer: recorded:true, contenido y versión vigentes
 r=await ant.GET(new Request("http://l/",{headers:H(phys)}),PP(pid));const g=await r.json();
 ok(r.status===200&&g.recorded===true&&g.version===1&&g.content.noPatologicos.tabaquismo===true,"GET_RECORDED");
 // re-capturar el singleton (expectedVersion 0 sobre v1) -> conflicto
 r=await ant.POST(recordReq(phys,{content:CONTENT,occurredAt:ISO}),PP(pid));ok(r.status===409,"RECORD_TWICE_409");
 // enmendar con If-Match:1 (AMENDED v2), el histórico no se sobrescribe
 r=await amd.POST(amendReq(phys,1,{content:CONTENT2,reason:"el paciente dejó de fumar",occurredAt:ISO}),PP(pid));ok(r.status===201&&(await r.json()).state==="AMENDED","AMEND_201");
 r=await ant.GET(new Request("http://l/",{headers:H(phys)}),PP(pid));const g2=await r.json();
 ok(g2.version===2&&g2.content.noPatologicos.tabaquismo===false,"GET_AMENDED_VIGENTE");
 // enmendar con versión vieja (If-Match:1 sobre v2) -> conflicto de concurrencia
 r=await amd.POST(amendReq(phys,1,{content:CONTENT2,reason:"otra vez",occurredAt:ISO}),PP(pid));ok(r.status===409,"AMEND_STALE_409");
 // enmendar a un paciente SIN antecedentes -> 404 (no existe el agregado)
 const pid2=await freshPatient(TA);
 r=await amd.POST(amendReq(phys,0,{content:CONTENT2,reason:"x",occurredAt:ISO}),PP(pid2));ok(r.status===404,"AMEND_WITHOUT_RECORD_404");
 // aislamiento por tenant: otro tenant no ve ni enmienda
 const physB=tok(TB);
 r=await amd.POST(amendReq(physB,2,{content:CONTENT2,reason:"x",occurredAt:ISO}),PP(pid));ok(r.status===404,"CROSS_TENANT_404");
 // idempotencia: re-capturar con la MISMA llave (otro paciente nuevo) devuelve replay 200, no un segundo evento
 const pid3=await freshPatient(TA);const k=idem();
 r=await ant.POST(recordReq(phys,{content:CONTENT,occurredAt:ISO},k),PP(pid3));ok(r.status===201,"RECORD_P3_201");
 r=await ant.POST(recordReq(phys,{content:CONTENT,occurredAt:ISO},k),PP(pid3));ok(r.status===200&&(await r.json()).replayed===true,"RECORD_REPLAY_200");
 // sin scope antecedentes:write -> 403
 const noScope=tok(TA,["PHYSICIAN"],["patient:read"]);
 r=await ant.POST(recordReq(noScope,{content:CONTENT,occurredAt:ISO}),PP(await freshPatient(TA)));ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
