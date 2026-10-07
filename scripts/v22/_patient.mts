// Auditoría 2026-09-19 (L-07): desde el lote 10d todo comando de creación exige que el `patientId` sea un paciente
// REGISTRADO del tenant (404 si no). Las pruebas en vivo que antes usaban UUID aleatorios registran aquí al paciente
// sintético antes de usarlo. Idempotente: la clave deriva del patientId (repetir la llamada no duplica ni falla).
// El alta exige `patient:write`; si el token de la prueba no lo trae, se firma uno equivalente (mismo sub/tenant/roles).
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts";
const{verifySession,signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
export async function ensurePatient(token:string,patientId:string,opts:{birthDate?:string;sexAtBirth?:"FEMALE"|"MALE"|"INTERSEX"|"UNKNOWN";name?:string}={}):Promise<void>{
 const secret=SIGNING_SECRET; // garantizado `string` por _live-env.mts, que lo genera si el entorno no lo trae
 const c=verifySession(token,secret);
 const t=c.scopes.includes("patient:write")?token:signSession({...c,scopes:[...c.scopes,"patient:write"]},secret);
 const key=crypto.createHash("sha256").update(`ensure-patient:${c.tenantId}:${patientId}`).digest("hex").slice(0,32);
 const r=await patR.POST(new Request("http://l/",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+t,"idempotency-key":key},
  body:JSON.stringify({patientId,name:opts.name??`Paciente ${patientId.slice(0,8)}`,birthDate:opts.birthDate??"1980-01-01",sexAtBirth:opts.sexAtBirth??"UNKNOWN",occurredAt:"2026-09-01T08:00:00.000Z"})}));
 if(r.status===201||r.status===200)return;
 // 409 CONCURRENCY_CONFLICT: el paciente ya fue registrado por otra llamada (otro actor o clave): existe, que es lo que importa.
 const body=await r.text();if(r.status===409&&body.includes("CONCURRENCY_CONFLICT"))return;
 throw new Error("ENSURE_PATIENT_FAILED:"+r.status+":"+body);
}
// Variante por tenant: firma su propio token de alta (médico sintético) para el tenant dado.
export async function ensurePatientIn(tenantId:string,patientId:string,opts:Parameters<typeof ensurePatient>[2]={}):Promise<void>{
 const secret=SIGNING_SECRET; // garantizado `string` por _live-env.mts, que lo genera si el entorno no lo trae
 const now=Math.floor(Date.now()/1000);
 const t=signSession({sub:crypto.randomUUID(),tenantId,roles:["PHYSICIAN"],scopes:["patient:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},secret);
 await ensurePatient(t,patientId,opts);
}
// Paciente nuevo ya registrado en el tenant (para usos de un solo disparo).
export async function freshPatient(tenantId:string,opts:Parameters<typeof ensurePatient>[2]={}):Promise<string>{const id=crypto.randomUUID();await ensurePatientIn(tenantId,id,opts);return id;}
