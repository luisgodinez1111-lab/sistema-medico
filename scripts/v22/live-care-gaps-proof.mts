// EPIC AA — Evidencia física del worklist de care gaps (reglas sobre el timeline) contra Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-aa-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const im=await import("../../apps/web/app/api/v1/immunizations/route");
const ref=await import("../../apps/web/app/api/v1/referrals/route");
const co=await import("../../apps/web/app/api/v1/consents/route");
const pre=await import("../../apps/web/app/api/v1/consents/[consentId]/presentation/route");
const gaps=await import("../../apps/web/app/api/v1/patients/[patientId]/care-gaps/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const SCOPES=["patient:read","immunization:write","referral:write","consent:write"];
function tok(t:string,scopes=SCOPES){return signSession({sub:crypto.randomUUID(),tenantId:t,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const TP=(id:string)=>({params:Promise.resolve({patientId:id})});const ISO="2026-07-07T07:00:00.000Z";const idem=()=>crypto.randomUUID();
const P=(t:string,body:Record<string,unknown>)=>new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({...body,occurredAt:ISO})});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const t=tok(TA);const pat=crypto.randomUUID();
 // pendiente MEDIUM: vacuna DUE
 await im.POST(P(t,{immunizationId:crypto.randomUUID(),patientId:pat,vaccineCode:"SRP",dose:"1"}));
 // pendiente LOW: interconsulta REQUESTED (sin aceptar)
 await ref.POST(P(t,{referralId:crypto.randomUUID(),patientId:pat,specialty:"Cardiología",reason:"Soplo"}));
 // pendiente MEDIUM: consentimiento PRESENTED (sin firmar)
 const csId=crypto.randomUUID();
 await co.POST(P(t,{consentId:csId,patientId:pat,scopeType:"PROCEDURE",documentRef:"CI-1"}));
 await pre.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),({params:Promise.resolve({consentId:csId})} as never));
 // worklist
 let r=await gaps.GET(new Request("http://l/",{headers:H(t)}),TP(pat));
 ok(r.status===200,"CARE_GAPS_200");
 const list=((await r.json()).gaps||[]) as {code:string;priority:string;aggregateType:string}[];
 ok(list.length===3,"THREE_GAPS");
 const codes=list.map(x=>x.code);
 ok(codes.includes("IMMUNIZATION_DUE")&&codes.includes("REFERRAL_UNACCEPTED")&&codes.includes("CONSENT_PENDING_SIGNATURE"),"EXPECTED_CODES");
 // orden determinista: MEDIUM (Consent, Immunization) antes que LOW (Referral)
 ok(list[list.length-1]!.code==="REFERRAL_UNACCEPTED","LOW_PRIORITY_LAST");
 // cross-tenant: tenant B no ve pendientes del paciente
 const tB=tok(TB);
 r=await gaps.GET(new Request("http://l/",{headers:H(tB)}),TP(pat));
 ok(r.status===200&&((await r.json()).gaps||[]).length===0,"CROSS_TENANT_EMPTY");
 // sin scope patient:read -> 403
 const noScope=tok(TA,["immunization:write"]);
 r=await gaps.GET(new Request("http://l/",{headers:H(noScope)}),TP(pat));
 ok(r.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
