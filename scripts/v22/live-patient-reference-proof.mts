// Auditoría 2026-09-19 (L-07) — PRUEBA EN VIVO contra PostgreSQL real: el `patientId` de un comando de creación debe ser un
// paciente REGISTRADO del tenant. Antes cualquier UUID válido creaba signos vitales, alergias, medicaciones, problemas,
// resultados o citas "huérfanos". Ahora: 404 NOT_FOUND si no existe en el tenant (incluido un paciente REAL de otro
// tenant: RLS + verificación), 201 tras registrarlo, y un paciente INACTIVO sigue admitiendo registros (un resultado que
// llega tras la baja no se pierde).
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"l07-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const deact=await import("../../apps/web/app/api/v1/patients/[patientId]/deactivation/route");
const vit=await import("../../apps/web/app/api/v1/vitals/route");
const al=await import("../../apps/web/app/api/v1/allergies/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const prob=await import("../../apps/web/app/api/v1/problems/route");
const res=await import("../../apps/web/app/api/v1/results/route");
const ap=await import("../../apps/web/app/api/v1/appointments/route");
const enc=await import("../../apps/web/app/api/v1/encounters/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const SCOPES=["patient:write","patient:read","vital:write","allergy:write","medication:propose","medication:write","problem:write","result:write","appointment:write","encounter:write"];
function tok(tenant:string){return signSession({sub:crypto.randomUUID(),tenantId:tenant,roles:["PHYSICIAN"],scopes:SCOPES,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const ISO="2026-09-22T15:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const post=(mod:{POST:(r:Request,c?:never)=>Promise<Response>},t:string,body:Record<string,unknown>)=>mod.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({occurredAt:ISO,...body})}));
type Cmd=[string,{POST:(r:Request,c?:never)=>Promise<Response>},(pat:string)=>Record<string,unknown>];
const CMDS:Cmd[]=[
 ["vital",vit,pat=>({vitalId:crypto.randomUUID(),patientId:pat,vitalType:"HR",value:"72",unit:"lpm"})],
 ["allergy",al,pat=>({allergyId:crypto.randomUUID(),patientId:pat,substance:"penicilina",severity:"MODERATE",reaction:"urticaria"})],
 ["medication",meds,pat=>({medicationId:crypto.randomUUID(),patientId:pat,drugCode:"paracetamol-500",dose:"500mg",route:"VO",frequency:"c/8h"})],
 ["problem",prob,pat=>({problemId:crypto.randomUUID(),patientId:pat,code:"J06.9"})],
 ["result",res,pat=>({resultId:crypto.randomUUID(),patientId:pat,orderId:crypto.randomUUID(),analyte:"POTASSIUM",value:"4.2",unit:"mEq/L"})],
 ["appointment",ap,pat=>({appointmentId:crypto.randomUUID(),patientId:pat,startAt:new Date(Date.parse(ISO)+Math.floor(Math.random()*1e9)).toISOString(),reason:"Control"})],
 ["encounter",enc,pat=>({encounterId:crypto.randomUUID(),patientId:pat})],
];
try{
 const physA=tok(TA),physB=tok(TB);
 // 1) paciente inexistente: 404 en cada comando de creación, sin escribir nada
 const ghost=crypto.randomUUID();
 for(const[name,mod,body]of CMDS){const r=await post(mod,physA,body(ghost));ok(r.status===404&&((await r.json()) as{error:{code:string}}).error.code==="NOT_FOUND",`GHOST_${name.toUpperCase()}_404`);}
 // 2) registrado en el tenant: 201 en cada comando
 const pat=crypto.randomUUID();
 ok((await post(patR,physA,{patientId:pat,name:"Paciente Referencia",birthDate:"1980-01-01",sexAtBirth:"UNKNOWN"})).status===201,"PATIENT_REGISTERED");
 for(const[name,mod,body]of CMDS){const r=await post(mod,physA,body(pat));ok(r.status===201,`REGISTERED_${name.toUpperCase()}_201`);}
 // 3) un paciente REAL de otro tenant no existe para este tenant (RLS + verificación): 404, no 201
 const r3=await post(vit,physB,{vitalId:crypto.randomUUID(),patientId:pat,vitalType:"HR",value:"72",unit:"lpm"});ok(r3.status===404,"OTHER_TENANT_PATIENT_404");
 // 4) paciente INACTIVO: sigue admitiendo registros (un resultado tardío no se pierde)
 const r4=await deact.POST(new Request("http://l/",{method:"POST",headers:H(physA,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"Cambio de consultorio",occurredAt:ISO})}),{params:Promise.resolve({patientId:pat})} as never);
 ok(r4.status===200||r4.status===201,"PATIENT_DEACTIVATED");
 const r5=await post(res,physA,{resultId:crypto.randomUUID(),patientId:pat,orderId:crypto.randomUUID(),analyte:"POTASSIUM",value:"4.4",unit:"mEq/L"});ok(r5.status===201,"INACTIVE_PATIENT_STILL_ACCEPTS_RESULTS");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
