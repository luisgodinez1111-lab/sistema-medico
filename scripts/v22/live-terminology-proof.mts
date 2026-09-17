// EPIC AM — Evidencia física de la codificación CIE-10 (validación + descripción canónica + búsqueda) contra Neon.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-am-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const pr=await import("../../apps/web/app/api/v1/problems/route");
const tm=await import("../../apps/web/app/api/v1/terminology/icd10/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:read","problem:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();
 // agregar problema con código CIE-10 válido -> se codifica con descripción canónica (aunque no mande description)
 let r=await pr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:crypto.randomUUID(),code:"e11",occurredAt:ISO})}));
 const okBody=await r.json();
 ok(r.status===201,"PROBLEM_CODED_201");
 ok(okBody.code==="E11"&&okBody.description==="Diabetes mellitus tipo 2"&&okBody.codeSystem==="ICD-10","CANONICAL_DESCRIPTION_ATTACHED");
 // código inválido -> 400 VALIDATION_ERROR
 r=await pr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:crypto.randomUUID(),code:"NOPE.123",occurredAt:ISO})}));
 const bad=await r.json();
 ok(r.status===400&&bad.error.code==="VALIDATION_ERROR","INVALID_CODE_400");
 // búsqueda de terminología por texto
 r=await tm.GET(new Request("http://l/api/v1/terminology/icd10?q=diabetes",{headers:H(phys)}));
 const s=await r.json();
 ok(r.status===200&&Array.isArray(s.results)&&s.results.some((e:{code:string})=>e.code==="E11"),"SEARCH_FINDS_DIABETES");
 // lookup por código exacto
 r=await tm.GET(new Request("http://l/api/v1/terminology/icd10?code=I10",{headers:H(phys)}));
 const l=await r.json();
 ok(r.status===200&&l.valid===true&&l.entry.description==="Hipertensión esencial (primaria)","LOOKUP_VALID");
 // sin scope patient:read -> 403
 const noScope=tok(["problem:write"]);
 r=await tm.GET(new Request("http://l/api/v1/terminology/icd10?q=x",{headers:H(noScope)}));
 ok(r.status===403,"MISSING_READ_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
