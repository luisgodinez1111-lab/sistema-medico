// EPIC AN — Evidencia física de la interpretación de signos vitales (NORMAL/ABNORMAL/CRITICAL) contra Neon.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const vt=await import("../../apps/web/app/api/v1/vitals/route");
const am=await import("../../apps/web/app/api/v1/vitals/[vitalId]/amendment/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["vital:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["NURSE"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({vitalId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function rec(t:string,vitalType:string,value:string,unit:string){const id=crypto.randomUUID();const r=await vt.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:id,patientId:await freshPatient(TA),vitalType,value,unit,occurredAt:ISO})}));return{id,body:await r.json(),st:r.status};}
try{
 const nurse=tok();
 // presión normal
 let x=await rec(nurse,"BP","120/80","mmHg");ok(x.st===201&&x.body.status==="NORMAL","BP_NORMAL");
 // crisis hipertensiva -> CRITICAL
 x=await rec(nurse,"BP","190/125","mmHg");ok(x.st===201&&x.body.status==="CRITICAL"&&x.body.interpretation==="Crisis hipertensiva","BP_CRITICAL");
 // SpO2 baja -> CRITICAL
 x=await rec(nurse,"SPO2","85","%");ok(x.st===201&&x.body.status==="CRITICAL","SPO2_CRITICAL");
 // fiebre -> ABNORMAL
 x=await rec(nurse,"TEMP","38.5","C");ok(x.st===201&&x.body.status==="ABNORMAL","TEMP_ABNORMAL");
 // enmienda re-interpreta: de crítico a normal
 const c=await rec(nurse,"BP","190/125","mmHg");ok(c.body.status==="CRITICAL","BP_START_CRITICAL");
 const r=await am.POST(new Request("http://l/",{method:"POST",headers:H(nurse,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({value:"120/80",unit:"mmHg",reason:"Reverificado",occurredAt:ISO})}),PP(c.id));
 ok(r.status===201&&(await r.json()).status==="NORMAL","AMEND_RECLASSIFIES_NORMAL");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
