// EPIC G/UI (Lote G) — Evidencia física: interconsultas con DESTINATARIO (directorio) + registro POBLACIONAL.
// Solicita interconsultas nombrando al médico/institución (recipientName/institution/priority/referralType),
// transiciona una (aceptar->completar), y consulta GET /api/v1/referrals -> filas clínica-wide con estado por última
// transición + conteos + DIRECTORIO de destinatarios distintos. Retrocompatible (interconsulta sin destinatario).
// RLS-scoped. vs Postgres local.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const refR=await import("../../apps/web/app/api/v1/referrals/route");
const accR=await import("../../apps/web/app/api/v1/referrals/[referralId]/acceptance/route");
const comR=await import("../../apps/web/app/api/v1/referrals/[referralId]/completion/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","referral:write"],roles=["PHYSICIAN"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();const at=new Date().toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birth(45),sexAtBirth:"FEMALE",occurredAt:at})}));}
async function refer(t:string,p:string,specialty:string,reason:string,extra:Record<string,unknown>={}){const id=crypto.randomUUID();const r=await refR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({referralId:id,patientId:p,specialty,reason,occurredAt:at,...extra})}));return{id,status:r.status,version:Number((await r.json()).version??1)};}
function trans(mod:{POST:(r:Request,c:{params:Promise<{referralId:string}>})=>Promise<Response>},t:string,id:string,ver:number){return mod.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(ver)}),body:JSON.stringify({occurredAt:at})}),{params:Promise.resolve({referralId:id})});}
async function registry(t:string){const r=await refR.GET(new Request("http://l/api/v1/referrals",{headers:H(t)}));return{status:r.status,body:await r.json()};}
type Row={referralId:string;specialty:string;recipientName:string;recipientInstitution:string;priority:string;referralType:string;status:string};
type Dir={name:string;specialty:string;institution:string;count:number};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();
 const p1=crypto.randomUUID();await reg(phys,p1,`Ana Ref ${p1.slice(0,8)}`);
 const p2=crypto.randomUUID();await reg(phys,p2,`Beto Ref ${p2.slice(0,8)}`);
 // 2 interconsultas a la MISMA destinataria (directorio la agrupa) + 1 sin destinatario (retrocompat).
 const a=await refer(phys,p1,"Cardiología","Soplo sistólico",{recipientName:"Dra. Ruiz",recipientInstitution:"Hospital Ángeles",priority:"Urgente (48–72 h)",referralType:"Primera vez"});
 ok(a.status===201,"CREATE_201");
 await refer(phys,p2,"Cardiología","Arritmia",{recipientName:"Dra. Ruiz",recipientInstitution:"Hospital Ángeles",priority:"Rutina (4–8 semanas)",referralType:"Subsecuente"});
 await refer(phys,p2,"Nefrología","ERC etapa 3"); // sin destinatario: sigue siendo válida
 // a: REQUESTED -> ACCEPTED -> COMPLETED
 const acc=await trans(accR,phys,a.id,a.version);ok(acc.status<400,"ACCEPTED");
 ok((await trans(comR,phys,a.id,Number((await acc.json()).version??2))).status<400,"COMPLETED");

 const g=await registry(phys);ok(g.status===200,"REGISTRY_200");
 const items=g.body.items as Row[];
 ok(g.body.total===3,"TOTAL_3");
 ok(g.body.completedCount===1,"COMPLETED_COUNT");
 ok(g.body.openCount===2,"OPEN_COUNT"); // las dos sin completar (una es la de Nefrología REQUESTED + la 2a de Cardiología REQUESTED)
 ok(g.body.patientsCount===2,"PATIENTS_DISTINCT");
 // el DESTINATARIO y sus campos viajaron y se leen tal cual.
 const one=items.find(r=>r.referralId===a.id)!;
 ok(one.recipientName==="Dra. Ruiz"&&one.recipientInstitution==="Hospital Ángeles","RECIPIENT_STORED");
 ok(one.priority==="Urgente (48–72 h)"&&one.referralType==="Primera vez","PRIORITY_TYPE_STORED");
 ok(one.status==="COMPLETED","STATUS_BY_LAST_TRANSITION");
 // la interconsulta sin destinatario no rompe nada (recipientName vacío).
 ok(items.some(r=>r.specialty==="Nefrología"&&!r.recipientName),"NO_RECIPIENT_OK");
 // DIRECTORIO: «Dra. Ruiz» aparece UNA vez, agrupada, con count=2; recipientsCount=1 destinatario distinto.
 const dir=g.body.directory as Dir[];
 ok(dir.length===1&&dir[0]!.name==="Dra. Ruiz"&&dir[0]!.count===2,"DIRECTORY_GROUPED");
 ok(g.body.recipientsCount===1,"DISTINCT_RECIPIENTS");
 // sin scope de interconsulta -> 403.
 const noScope=await registry(tok(["patient:write"]));ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
