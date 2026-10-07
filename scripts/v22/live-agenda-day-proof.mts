// EPIC CM — Evidencia física: agenda del día. Agenda citas (con consultorio/tipo/fin), transiciona
// estados, y consulta GET /appointments?date= con conteos + nombre del paciente. vs Neon.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const apR=await import("../../apps/web/app/api/v1/appointments/route");
const ciR=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/check-in/route");
const coR=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/completion/route");
const caR=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/cancellation/route");
const nsR=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/no-show/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","appointment:write","appointment:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();const at=new Date().toISOString();
const DATE="2026-11-20";
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function reg(t:string,p:string,name:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:"1990-01-01",sexAtBirth:"FEMALE",occurredAt:at})}));}
async function sched(t:string,id:string,p:string,startAt:string,reason:string,consultorio:string,apptType:string){return apR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({appointmentId:id,patientId:p,startAt,reason,consultorio,apptType,endAt:new Date(Date.parse(startAt)+30*60000).toISOString(),occurredAt:at})}));}
async function agenda(t:string,date:string){const r=await apR.GET(new Request(`http://l/api/v1/appointments?date=${date}`,{headers:H(t)}));return{status:r.status,body:await r.json()};}
async function range(t:string,from:string,to:string){const r=await apR.GET(new Request(`http://l/api/v1/appointments?from=${from}&to=${to}`,{headers:H(t)}));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 const p1=crypto.randomUUID();await reg(phys,p1,"María Fernández López");
 const p2=crypto.randomUUID();await reg(phys,p2,"Juan Pérez García");
 const a1=crypto.randomUUID(),a2=crypto.randomUUID(),a3=crypto.randomUUID(),a4=crypto.randomUUID(),a5=crypto.randomUUID();
 const s1=await sched(phys,a1,p1,`${DATE}T09:00:00.000Z`,"Primera vez","Consultorio 1","PRIMERA_VEZ");ok(s1.status===201,"SCHEDULE_201");
 await sched(phys,a2,p2,`${DATE}T10:00:00.000Z`,"Control DM2","Consultorio 1","CONTROL");
 await sched(phys,a3,p1,`${DATE}T11:00:00.000Z`,"Vacuna influenza","Consultorio 2","VACUNACION");
 await sched(phys,a4,p2,`${DATE}T12:00:00.000Z`,"Cancelar","Consultorio 1","CONSULTA_GENERAL");
 await sched(phys,a5,p1,`${DATE}T13:00:00.000Z`,"Inasistencia","Consultorio 1","CONSULTA_GENERAL");
 const post=(mod:{POST:(r:Request,c:{params:Promise<{appointmentId:string}>})=>Promise<Response>},id:string,ifm:string,body:Record<string,unknown>={})=>mod.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":ifm}),body:JSON.stringify({occurredAt:at,...body})}),{params:Promise.resolve({appointmentId:id})});
 // a1: SCHEDULED(v1) -> CHECKED_IN(v2) -> COMPLETED(v3)
 await post(ciR,a1,"1");await post(coR,a1,"2");
 // a4 -> CANCELLED ; a5 -> NO_SHOW
 await post(caR,a4,"1",{reason:"Reprogramada por el paciente"});
 await post(nsR,a5,"1");
 const g=await agenda(phys,DATE);
 ok(g.status===200,"AGENDA_200");
 const A=g.body.appointments as {appointmentId:string;patientName:string;startAt:string;consultorio:string;apptType:string;status:string;version:number}[];
 ok(A.length===5,"FIVE_APPTS");
 ok(A[0]!.startAt<A[1]!.startAt&&A[1]!.startAt<A[2]!.startAt,"SORTED_BY_TIME");
 ok(A[0]!.patientName==="María Fernández López","PATIENT_NAME_JOINED");
 ok(A[0]!.consultorio==="Consultorio 1"&&A[0]!.apptType==="PRIMERA_VEZ","CONSULTORIO_TYPE");
 const byId=(id:string)=>A.find(x=>x.appointmentId===id)!;
 ok(byId(a1).status==="COMPLETED"&&byId(a1).version===3,"A1_COMPLETED_V3");
 ok(byId(a2).status==="SCHEDULED"&&byId(a2).version===1,"A2_SCHEDULED_V1");
 ok(byId(a4).status==="CANCELLED"&&byId(a4).version===2,"A4_CANCELLED_V2");
 ok(byId(a5).status==="NO_SHOW"&&byId(a5).version===2,"A5_NOSHOW_V2");
 ok(g.body.counts.programadas===5&&g.body.counts.atendidas===1&&g.body.counts.canceladas===2,"COUNTS");
 // otra fecha -> vacía
 const empty=await agenda(phys,"2026-11-21");ok(empty.body.appointments.length===0,"OTHER_DAY_EMPTY");
 // Lote F — rango semanal/mensual (from/to inclusivos): la semana que contiene DATE trae las 5 citas.
 const wk=await range(phys,"2026-11-16","2026-11-22");ok(wk.status===200,"RANGE_200");
 ok((wk.body.appointments as unknown[]).length===5,"RANGE_FIVE_APPTS");
 ok(wk.body.from==="2026-11-16"&&wk.body.to==="2026-11-22","RANGE_ECHOES_WINDOW");
 ok(wk.body.counts.programadas===5&&wk.body.counts.atendidas===1&&wk.body.counts.canceladas===2,"RANGE_COUNTS");
 const wkEmpty=await range(phys,"2026-12-01","2026-12-31");ok((wkEmpty.body.appointments as unknown[]).length===0,"RANGE_OTHER_MONTH_EMPTY");
 // validaciones del rango
 const bad1=await apR.GET(new Request("http://l/api/v1/appointments?from=2026-11-16",{headers:H(phys)}));ok(bad1.status===400,"RANGE_FROM_WITHOUT_TO_400");
 const bad2=await range(phys,"2026-11-22","2026-11-16");ok(bad2.status===400,"RANGE_INVERTED_400");
 const bad3=await range(phys,"2026-01-01","2026-12-31");ok(bad3.status===400,"RANGE_TOO_WIDE_400");
 // sin scope -> 403
 const noScope=await agenda(tok(["patient:write"]),DATE);ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
