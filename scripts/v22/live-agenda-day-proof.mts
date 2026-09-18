// EPIC CM — Evidencia física: agenda del día. Agenda citas (con consultorio/tipo/fin), transiciona
// estados, y consulta GET /appointments?date= con conteos + nombre del paciente. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-cm-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const apR=await import("../../apps/web/app/api/v1/appointments/route");
const ciR=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/check-in/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","appointment:write","appointment:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();const at=new Date().toISOString();
const DATE="2026-11-20";
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function reg(t:string,p:string,name:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:"1990-01-01",sexAtBirth:"FEMALE",occurredAt:at})}));}
async function sched(t:string,id:string,p:string,startAt:string,reason:string,consultorio:string,apptType:string){return apR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({appointmentId:id,patientId:p,startAt,reason,consultorio,apptType,endAt:new Date(Date.parse(startAt)+30*60000).toISOString(),occurredAt:at})}));}
async function agenda(t:string,date:string){const r=await apR.GET(new Request(`http://l/api/v1/appointments?date=${date}`,{headers:H(t)}));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 const p1=crypto.randomUUID();await reg(phys,p1,"María Fernández López");
 const p2=crypto.randomUUID();await reg(phys,p2,"Juan Pérez García");
 const a1=crypto.randomUUID(),a2=crypto.randomUUID(),a3=crypto.randomUUID();
 const s1=await sched(phys,a1,p1,`${DATE}T09:00:00.000Z`,"Primera vez","Consultorio 1","PRIMERA_VEZ");ok(s1.status===201,"SCHEDULE_201");
 await sched(phys,a2,p2,`${DATE}T10:00:00.000Z`,"Control DM2","Consultorio 1","CONTROL");
 await sched(phys,a3,p1,`${DATE}T11:00:00.000Z`,"Vacuna influenza","Consultorio 2","VACUNACION");
 // transiciona a1 -> CHECKED_IN (en espera)
 await ciR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at})}),{params:Promise.resolve({appointmentId:a1})});
 const g=await agenda(phys,DATE);
 ok(g.status===200,"AGENDA_200");
 const A=g.body.appointments as {appointmentId:string;patientName:string;startAt:string;consultorio:string;apptType:string;status:string}[];
 ok(A.length===3,"THREE_APPTS");
 ok(A[0]!.startAt<A[1]!.startAt&&A[1]!.startAt<A[2]!.startAt,"SORTED_BY_TIME");
 ok(A[0]!.patientName==="María Fernández López","PATIENT_NAME_JOINED");
 ok(A[0]!.consultorio==="Consultorio 1"&&A[0]!.apptType==="PRIMERA_VEZ","CONSULTORIO_TYPE");
 ok(A.find(x=>x.appointmentId===a1)!.status==="CHECKED_IN","STATUS_CHECKED_IN");
 ok(g.body.counts.programadas===3&&g.body.counts.enEspera===1,"COUNTS");
 // otra fecha -> vacía
 const empty=await agenda(phys,"2026-11-21");ok(empty.body.appointments.length===0,"OTHER_DAY_EMPTY");
 // sin scope -> 403
 const noScope=await agenda(tok(["patient:write"]),DATE);ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
