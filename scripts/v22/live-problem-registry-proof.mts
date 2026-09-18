// EPIC Q/UI — Evidencia física: registro de problemas de toda la clínica (vista Problemas). Registra problemas
// CIE-10 de varios pacientes/categorías, transiciona uno a RESOLVED y otro a CHRONIC, y consulta GET /problems
// -> categoría-UI + estado + conteos por estado/categoría + top de pacientes + join del nombre. RLS-scoped. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-q-reg-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const prR=await import("../../apps/web/app/api/v1/problems/route");
const resoR=await import("../../apps/web/app/api/v1/problems/[problemId]/resolution/route");
const chrR=await import("../../apps/web/app/api/v1/problems/[problemId]/chronicity/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","problem:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string,y:number,sex:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birth(y),sexAtBirth:sex,occurredAt:at()})}));}
async function add(t:string,p:string,code:string){const id=crypto.randomUUID();const r=await prR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:id,patientId:p,code,occurredAt:at()})}));const j=await r.json() as{code?:string};return{id,status:r.status,code:j.code??code};}
async function resolve(t:string,id:string,v:number){return resoR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({note:"Cuadro resuelto",occurredAt:at()})}),{params:Promise.resolve({problemId:id})});}
async function chronic(t:string,id:string,v:number){return chrR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({problemId:id})});}
async function list(t:string){const r=await prR.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();
 const p1=crypto.randomUUID(),p2=crypto.randomUUID(),p3=crypto.randomUUID();
 await reg(phys,p1,"Ana López García",34,"FEMALE");
 await reg(phys,p2,"Carlos Mendoza",56,"MALE");
 await reg(phys,p3,"María Torres",28,"FEMALE");
 // p1: Diabetes(E11.9)+Hipertensión(I10); p2: Asma(J45.909)+Gastritis(K29.70); p3: Ansiedad(F41.9)
 const dm=await add(phys,p1,"E11.9");
 const htn=await add(phys,p1,"I10");
 const asma=await add(phys,p2,"J45.909");
 const gas=await add(phys,p2,"K29.70");
 const anx=await add(phys,p3,"F41.9");
 ok(dm.status===201&&asma.status===201&&anx.status===201,"ADD_201");

 // transiciones: gastritis -> RESOLVED ; asma -> CHRONIC (En seguimiento)
 const rr=await resolve(phys,gas.id,1);ok(rr.status===200||rr.status===201,"RESOLVE_OK");
 const cr=await chronic(phys,asma.id,1);ok(cr.status===200||cr.status===201,"CHRONIC_OK");

 const L=await list(phys);ok(L.status===200,"LIST_200");
 const b=L.body as{total:number;items:{code:string;category:string;statusLabel:string;status:string;patientName:string}[];byStatus:Record<string,number>;byCategory:Record<string,number>;topPatients:{name:string;count:number}[]};
 ok(b.total===5,"TOTAL_5");
 const byCode=(c:string)=>b.items.find(i=>i.code===c);
 // categoría-UI derivada de la categoría CIE-10
 ok(byCode(dm.code)?.category==="Endocrinológicos","CAT_ENDO");
 ok(byCode(htn.code)?.category==="Cardiovasculares","CAT_CARDIO");
 ok(byCode(anx.code)?.category==="Psiquiátricos","CAT_PSYCH");
 // join del nombre + etiqueta de estado ES
 ok(byCode(dm.code)?.patientName==="Ana López García","PATIENT_JOIN");
 // estados tras transición
 ok(byCode(gas.code)?.status==="RESOLVED"&&byCode(gas.code)?.statusLabel==="Resuelto","STATUS_RESOLVED");
 ok(byCode(asma.code)?.status==="CHRONIC"&&byCode(asma.code)?.statusLabel==="En seguimiento","STATUS_CHRONIC");
 ok(byCode(dm.code)?.status==="ACTIVE","STATUS_ACTIVE");
 // conteos por estado: 3 activos (E11.9,I10,F41.9), 1 en seguimiento (J45.909), 1 resuelto (K29.70)
 ok(b.byStatus.activos===3&&b.byStatus.enSeguimiento===1&&b.byStatus.resueltos===1,"STATUS_COUNTS");
 // conteos por categoría
 ok(b.byCategory.Endocrinológicos===1&&b.byCategory.Cardiovasculares===1&&b.byCategory.Psiquiátricos===1,"CATEGORY_COUNTS");
 // top de pacientes: p1 y p2 con 2 cada uno
 ok(b.topPatients[0]!.count===2,"TOP_PATIENTS");

 // sin scope -> 403
 const noScope=await list(tok(["patient:read"]));
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
