// EPIC V/UI — Evidencia física: registro de vacunación de toda la clínica (vista Vacunas). Programa dosis DUE
// de varios pacientes/vacunas, administra algunas (lote+sitio), y consulta GET /immunizations -> estado + lote
// + fecha de aplicación + conteos (aplicadas/pendientes/pacientes) + cobertura por vacuna + join del nombre. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const imR=await import("../../apps/web/app/api/v1/immunizations/route");
const admR=await import("../../apps/web/app/api/v1/immunizations/[immunizationId]/administration/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","immunization:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string,y:number,sex:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birth(y),sexAtBirth:sex,occurredAt:at()})}));}
async function due(t:string,p:string,vaccineCode:string,dose:string){const id=crypto.randomUUID();const r=await imR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({immunizationId:id,patientId:p,vaccineCode,dose,occurredAt:at()})}));return{id,status:r.status};}
async function admin(t:string,id:string,lot:string,v:number){return admR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({lot,site:"Brazo izquierdo",occurredAt:at()})}),{params:Promise.resolve({immunizationId:id})});}
async function list(t:string){const r=await imR.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();
 const p1=crypto.randomUUID(),p2=crypto.randomUUID(),p3=crypto.randomUUID();
 await reg(phys,p1,"Ana López García",34,"FEMALE");
 await reg(phys,p2,"Carlos Mendoza",56,"MALE");
 await reg(phys,p3,"María Torres",28,"FEMALE");
 // p1: Influenza (se aplica), p2: Influenza (se aplica) + SRP (pendiente), p3: Neumococo (pendiente)
 const f1=await due(phys,p1,"INFLUENZA","1/1");
 const f2=await due(phys,p2,"INFLUENZA","1/1");
 await due(phys,p2,"SRP","1/2");
 await due(phys,p3,"NEUMO","1/1");
 // R02a-IMM-01: el código de vacuna ya no es texto libre — «Neumococo 13V» no pertenece al esquema y se rechaza.
 const libre=await imR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),
  body:JSON.stringify({immunizationId:crypto.randomUUID(),patientId:p3,vaccineCode:"Neumococo 13V",dose:"1/1",occurredAt:at()})}));
 ok(libre.status===400,"CODIGO_DE_VACUNA_FUERA_DEL_ESQUEMA_400");
 ok(f1.status===201&&f2.status===201,"DUE_201");

 // administrar Influenza de p1 y p2 -> COMPLETE
 const a1=await admin(phys,f1.id,"A3F2K",1);ok(a1.status===200||a1.status===201,"ADMIN1_OK");
 const a2=await admin(phys,f2.id,"L9K4D",1);ok(a2.status===200||a2.status===201,"ADMIN2_OK");

 const L=await list(phys);ok(L.status===200,"LIST_200");
 const b=L.body as{total:number;appliedCount:number;pendingCount:number;vaccinatedPatients:number;incompleteSchemes:number;byVaccine:Record<string,number>;items:{vaccine:string;statusLabel:string;status:string;lot:string;patientName:string;appliedAt:string}[]};
 ok(b.total===4,"TOTAL_4");
 ok(b.appliedCount===2&&b.pendingCount===2,"APPLIED_PENDING_COUNTS");
 ok(b.vaccinatedPatients===2,"VACCINATED_PATIENTS_2");
 ok(b.incompleteSchemes===2,"INCOMPLETE_SCHEMES_2");
 ok(b.byVaccine["INFLUENZA"]===2,"COVERAGE_INFLUENZA_2"); // R02a-IMM-01: los códigos se normalizan al vocabulario del esquema
 const inf=b.items.find(i=>i.vaccine==="INFLUENZA"&&i.status==="COMPLETE");
 ok(!!inf&&inf.statusLabel==="Completa","STATUS_COMPLETA");
 ok(inf?.lot==="A3F2K"||inf?.lot==="L9K4D","LOT_JOINED");
 ok(!!inf?.appliedAt,"APPLIED_DATE_PRESENT");
 ok(b.items.find(i=>i.vaccine==="SRP")?.statusLabel==="Pendiente","STATUS_PENDIENTE");
 ok(b.items.find(i=>i.vaccine==="Influenza")?.patientName!=="Paciente","PATIENT_JOIN");

 // sin scope -> 403
 const noScope=await list(tok(["patient:read"]));
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
