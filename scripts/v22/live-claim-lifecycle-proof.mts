// EPIC Y — Evidencia física del ciclo de reclamación (draft/code/submit/reject/resubmit/pay/void) contra Neon.
// Seguimiento de ESTADO; no mueve dinero.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-y-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const cl=await import("../../apps/web/app/api/v1/claims/route");
const cod=await import("../../apps/web/app/api/v1/claims/[claimId]/coding/route");
const sub=await import("../../apps/web/app/api/v1/claims/[claimId]/submission/route");
const pay=await import("../../apps/web/app/api/v1/claims/[claimId]/payment/route");
const rej=await import("../../apps/web/app/api/v1/claims/[claimId]/rejection/route");
const vo=await import("../../apps/web/app/api/v1/claims/[claimId]/void/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["CLINICAL_ADMIN"],scopes=["billing:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({claimId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await cl.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({claimId:id,patientId:crypto.randomUUID(),amount:"1500.00",currency:"MXN",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const adm=tok(TA);
 // draft -> code -> submit -> reject -> resubmit -> pay
 let{id,r}=await mk(adm);ok(r.status===201&&(await r.json()).state==="DRAFT","DRAFT_201");
 r=await cod.POST(new Request("http://l/",B(adm,1,{codes:["E11","I10"]})),PP(id));ok(r.status===201&&(await r.json()).state==="CODED","CODE_201");
 // profundidad CIE-10: codificar con un código inválido -> 400
 const badC=await mk(adm);
 r=await cod.POST(new Request("http://l/",B(adm,1,{codes:["ZZZ.999"]})),PP(badC.id));ok(r.status===400&&(await r.json()).error.code==="VALIDATION_ERROR","INVALID_ICD10_CODE_400");
 r=await sub.POST(new Request("http://l/",B(adm,2)),PP(id));ok(r.status===201&&(await r.json()).state==="SUBMITTED","SUBMIT_201");
 r=await rej.POST(new Request("http://l/",B(adm,3,{reason:"Falta póliza"})),PP(id));ok(r.status===201&&(await r.json()).state==="REJECTED","REJECT_201");
 r=await sub.POST(new Request("http://l/",B(adm,4)),PP(id));ok(r.status===201&&(await r.json()).state==="SUBMITTED","RESUBMIT_201");
 r=await pay.POST(new Request("http://l/",B(adm,5,{reference:"EOB-2026-777"})),PP(id));ok(r.status===201&&(await r.json()).state==="PAID","PAY_201");
 // SM: anular tras pago (terminal) -> 409
 r=await vo.POST(new Request("http://l/",B(adm,6,{reason:"x"})),PP(id));ok(r.status===409,"VOID_AFTER_PAID_409");
 // SM: enviar un DRAFT sin codificar -> 409
 const two=await mk(adm);
 r=await sub.POST(new Request("http://l/",B(adm,1)),PP(two.id));ok(r.status===409,"SUBMIT_WITHOUT_CODE_409");
 // anular desde CODED
 const three=await mk(adm);
 await cod.POST(new Request("http://l/",B(adm,1,{codes:["E11"]})),PP(three.id));
 r=await vo.POST(new Request("http://l/",B(adm,2,{reason:"Duplicada"})),PP(three.id));ok(r.status===201&&(await r.json()).state==="VOIDED","VOID_FROM_CODED_201");
 // cross-tenant -> 404
 const admB=tok(TB);
 r=await cod.POST(new Request("http://l/",B(admB,1,{codes:["x"]})),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope billing:write -> 403
 const noScope=tok(TA,["CLINICAL_ADMIN"],["patient:read"]);
 r=await cl.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({claimId:crypto.randomUUID(),patientId:crypto.randomUUID(),amount:"1",currency:"MXN",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
