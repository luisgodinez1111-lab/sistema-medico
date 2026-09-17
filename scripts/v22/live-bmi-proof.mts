// EPIC BO — Evidencia física: IMC + clasificación WHO desde peso+talla del paciente. vs Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-bo-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const vitals=await import("../../apps/web/app/api/v1/vitals/route");
const bmi=await import("../../apps/web/app/api/v1/patients/[patientId]/bmi/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","vital:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const U:Record<string,string>={WEIGHT:"kg",HEIGHT:"cm"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:"Prueba",birthDate:birth(y),sexAtBirth:"MALE",occurredAt:at()})}));}
async function vital(t:string,p:string,vt:string,v:string){await vitals.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType:vt,value:v,unit:U[vt]??"u",occurredAt:at()})}));}
async function getBmi(t:string,p:string){const r=await bmi.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) adulto 100kg / 170cm -> IMC 34.6, OBESITY_I
 const p1=crypto.randomUUID();await reg(phys,p1,40);await vital(phys,p1,"WEIGHT","100");await vital(phys,p1,"HEIGHT","170");
 let g=await getBmi(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(Math.abs(g.body.bmi-34.6)<0.2&&g.body.category==="OBESITY_I","ADULT_BMI_OBESITY_I");
 // 2) usa el peso MÁS RECIENTE: baja a 70kg -> NORMAL
 await vital(phys,p1,"WEIGHT","70");g=await getBmi(phys,p1);ok(g.body.category==="NORMAL","USES_LATEST_WEIGHT");
 // 3) pediátrico (5a) -> computable pero flag pediátrico (percentil, no categoría de adulto)
 const p2=crypto.randomUUID();await reg(phys,p2,5);await vital(phys,p2,"WEIGHT","18");await vital(phys,p2,"HEIGHT","110");
 g=await getBmi(phys,p2);ok(g.body.computable===true&&g.body.pediatric===true&&g.body.category===undefined,"PEDIATRIC_PERCENTILE_FLAG");
 // 4) sin talla -> no computable
 const p3=crypto.randomUUID();await reg(phys,p3,40);await vital(phys,p3,"WEIGHT","70");
 g=await getBmi(phys,p3);ok(g.body.computable===false,"NO_HEIGHT_NOT_COMPUTABLE");
 // 5) sin scope patient:read -> 403
 const noScope=tok(["vital:write"]);g=await getBmi(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
