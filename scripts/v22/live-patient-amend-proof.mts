// EPIC CL/UI — Evidencia física: corrección de datos del paciente (AMENDED). Registra un paciente, edita
// nombre/sexo/CURP/teléfono con POST /patients/:id/amendment (if-match), y verifica que la LISTA y la
// DEMOGRAFÍA (consultation-snapshot) reflejan los datos corregidos. Estado sin cambios. RLS-scoped. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-cl-amend-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const amendR=await import("../../apps/web/app/api/v1/patients/[patientId]/amendment/route");
const snapR=await import("../../apps/web/app/api/v1/patients/[patientId]/consultation-snapshot/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const at=new Date().toISOString();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function reg(t:string,p:string){return patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":crypto.randomUUID()}),body:JSON.stringify({patientId:p,name:"Ana Lopez",birthDate:"1990-01-01",sexAtBirth:"FEMALE",curp:"AAAA900101MDFXXX01",phone:"5551112222",occupation:"Docente",occurredAt:at})}));}
async function amend(t:string,p:string,ifm:string,body:Record<string,unknown>){return amendR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":crypto.randomUUID(),"if-match":ifm}),body:JSON.stringify({...body,occurredAt:at})}),{params:Promise.resolve({patientId:p})});}
async function list(t:string){const r=await patR.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
async function snap(t:string,p:string){const r=await snapR.GET(new Request("http://l/",{method:"GET",headers:H(t)}),{params:Promise.resolve({patientId:p})});return{status:r.status,body:await r.json()};}
try{
 const phys=tok();const p=crypto.randomUUID();
 const rr=await reg(phys,p);ok(rr.status===201,"REGISTER_201");
 // v1 tras registro -> editar (if-match 1): nombre + apellido + CURP + telefono + ocupacion
 const a=await amend(phys,p,"1",{name:"Ana López García",curp:"LOGA900101MDFPRN08",phone:"5559998888",occupation:"Médica"});
 ok(a.status===200||a.status===201,"AMEND_OK");
 // la lista refleja el nombre corregido
 const L=await list(phys);ok(L.status===200,"LIST_200");
 const pr=(L.body.patients as {patientId:string;name:string;curp?:string;status:string}[]).find(x=>x.patientId===p)!;
 ok(pr.name==="Ana López García","LIST_NAME_AMENDED");
 ok(pr.curp==="LOGA900101MDFPRN08","LIST_CURP_AMENDED");
 ok(pr.status==="ACTIVE","STATUS_UNCHANGED");
 // la demografia (snapshot) refleja telefono/ocupacion corregidos y conserva lo no editado (birthDate)
 const S=await snap(phys,p);ok(S.status===200,"SNAP_200");
 const d=S.body.demographics as {name?:string;phone?:string;occupation?:string;birthDate?:string;curp?:string};
 ok(d.name==="Ana López García"&&d.phone==="5559998888"&&d.occupation==="Médica","SNAP_CONTACT_AMENDED");
 ok(d.birthDate==="1990-01-01","SNAP_UNEDITED_PRESERVED");
 // segunda enmienda con version desactualizada (if-match 1) -> conflicto 409/412
 const stale=await amend(phys,p,"1",{phone:"0000000000"});ok(stale.status===409||stale.status===412,"STALE_IFMATCH_CONFLICT");
 // sin scope -> 403
 const noScope=await amend(tok(["patient:read"]),p,"2",{phone:"123"});ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
