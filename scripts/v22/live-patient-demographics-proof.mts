// EPIC CL — Evidencia física: modelo de Paciente ampliado (CURP + contacto). Registra con los campos
// nuevos y los lee de vuelta por la lista (CURP) y por el snapshot de consulta (todos). vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const snapR=await import("../../apps/web/app/api/v1/patients/[patientId]/consultation-snapshot/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
const at=new Date().toISOString();const idem=()=>crypto.randomUUID();
const{result,ok,fin}=libro();
try{
 const phys=tok();const p=crypto.randomUUID();
 const body={patientId:p,name:"María Fernández López",birthDate:"1996-08-12",sexAtBirth:"FEMALE",occurredAt:at,
  curp:"fefm960812mchrrr04",phone:"+52 614 123 4567",email:"maria.fernandez@email.com",address:"Chihuahua, Chihuahua",occupation:"Licenciada en Diseño",maritalStatus:"Soltero(a)"};
 const reg=await patR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify(body)}));
 ok(reg.status===201,"REGISTER_201");
 // Lista: incluye CURP (normalizado a mayúsculas), edad/sexo.
 const lr=await patR.GET(new Request("http://l/",{headers:H(phys)}));const lb=await lr.json();
 const row=(lb.patients as {patientId:string;curp?:string;birthDate?:string;sexAtBirth?:string}[]).find(x=>x.patientId===p);
 ok(!!row,"IN_LIST");
 ok(row!.curp==="FEFM960812MCHRRR04","LIST_CURP_UPPERCASE");
 ok(row!.birthDate==="1996-08-12"&&row!.sexAtBirth==="FEMALE","LIST_DOB_SEX");
 // Snapshot: demographics con todos los campos de contacto.
 const sr=await snapR.GET(new Request("http://l/",{headers:H(phys)}),PP(p));const sb=await sr.json();
 ok(sr.status===200&&sb.registered===true,"SNAPSHOT_200");
 const d=sb.demographics;
 ok(d.curp==="FEFM960812MCHRRR04","SNAP_CURP");
 ok(d.phone==="+52 614 123 4567","SNAP_PHONE");
 ok(d.email==="maria.fernandez@email.com","SNAP_EMAIL");
 ok(d.address==="Chihuahua, Chihuahua","SNAP_ADDRESS");
 ok(d.occupation==="Licenciada en Diseño","SNAP_OCCUPATION");
 ok(d.maritalStatus==="Soltero(a)","SNAP_MARITAL");
 ok(d.name==="María Fernández López","SNAP_NAME");
 ok(d.age>=28&&d.age<=30,"SNAP_AGE_DERIVED");
 // Retrocompatible: paciente sin los campos nuevos no rompe.
 const p2=crypto.randomUUID();
 await patR.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p2,name:"Sin Contacto",birthDate:"1980-01-01",sexAtBirth:"MALE",occurredAt:at})}));
 const s2=await snapR.GET(new Request("http://l/",{headers:H(phys)}),PP(p2));const b2=await s2.json();
 ok(s2.status===200&&b2.demographics.curp===undefined&&b2.demographics.phone===undefined,"BACKWARD_COMPAT_NO_CONTACT");
}catch(e){fin(e);}
fin();
