// EPIC S — Evidencia física del registro de pacientes (registrar/listar/estado) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-s-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const pt=await import("../../apps/web/app/api/v1/patients/route");
const deact=await import("../../apps/web/app/api/v1/patients/[patientId]/deactivation/route");
const react=await import("../../apps/web/app/api/v1/patients/[patientId]/reactivation/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,scopes=["patient:read","patient:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok(TA);const p1=crypto.randomUUID();const uniq="P-"+crypto.randomUUID().slice(0,8);
 let r=await pt.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p1,name:uniq+" García",birthDate:"1975-03-03",sexAtBirth:"FEMALE",occurredAt:ISO})}));
 ok(r.status===201&&(await r.json()).status==="ACTIVE","REGISTER_ACTIVE_201");
 // list incluye al paciente con nombre + estado
 r=await pt.GET(new Request("http://l/",{headers:H(phys)}));
 const list=(await r.json()).patients as {patientId:string;name:string;status:string}[];
 const mine=list.find(x=>x.patientId===p1);
 ok(r.status===200&&!!mine&&mine.name.includes(uniq)&&mine.status==="ACTIVE","LIST_HAS_PATIENT_WITH_NAME");
 // deactivate -> INACTIVE
 r=await deact.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO})}),PP(p1));
 ok(r.status===201&&(await r.json()).status==="INACTIVE","DEACTIVATE_201_v2");
 r=await pt.GET(new Request("http://l/",{headers:H(phys)}));
 ok(((await r.json()).patients as {patientId:string;status:string}[]).find(x=>x.patientId===p1)?.status==="INACTIVE","LIST_REFLECTS_INACTIVE");
 // reactivate -> ACTIVE
 r=await react.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),PP(p1));
 ok(r.status===201&&(await r.json()).status==="ACTIVE","REACTIVATE_201_v3");
 // SM: reactivar un ACTIVE -> 409
 r=await react.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({occurredAt:ISO})}),PP(p1));
 ok(r.status===409,"REACTIVATE_ACTIVE_ILLEGAL_409");
 // cross-tenant: tenant B no ve al paciente y no puede tocarlo
 const physB=tok(TB);
 r=await pt.GET(new Request("http://l/",{headers:H(physB)}));
 ok(!((await r.json()).patients as {patientId:string}[]).some(x=>x.patientId===p1),"CROSS_TENANT_LIST_ISOLATED");
 r=await deact.POST(new Request("http://l/",{method:"POST",headers:H(physB,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({occurredAt:ISO})}),PP(p1));
 ok(r.status===404,"CROSS_TENANT_404");
 // sin scope patient:write -> 403
 const noWrite=tok(TA,["patient:read"]);
 r=await pt.POST(new Request("http://l/",{method:"POST",headers:H(noWrite,{"idempotency-key":idem()}),body:JSON.stringify({patientId:crypto.randomUUID(),name:"X",birthDate:"2000-01-01",sexAtBirth:"UNKNOWN",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
 // Auditoría S-08 — PAGINACIÓN por cursor y búsqueda en el servidor (en un tenant limpio, con nombres controlados).
 const TP=crypto.randomUUID();const physP=tok(TP);
 const names=["Ana Zapata","Bruno Ortiz","Carla Ruiz","Diego Peña","Elena Soto"];
 for(const n of names)await pt.POST(new Request("http://l/",{method:"POST",headers:H(physP,{"idempotency-key":idem()}),body:JSON.stringify({patientId:crypto.randomUUID(),name:n,birthDate:"1980-05-05",sexAtBirth:"UNKNOWN",...(n==="Carla Ruiz"?{curp:"RUCA800505MDFZRR09"}:{}),occurredAt:ISO})}));
 const get=async(qs:string)=>{const rr=await pt.GET(new Request("http://l/?"+qs,{headers:H(physP)}));return{status:rr.status,body:await rr.json() as {patients:{name:string}[];nextCursor:string|null;total:number}};};
 let g=await get("limit=2");ok(g.status===200&&g.body.patients.map(x=>x.name).join("|")==="Ana Zapata|Bruno Ortiz"&&g.body.total===5&&!!g.body.nextCursor,"PAGE_1_OF_3_SORTED_WITH_TOTAL");
 g=await get("limit=2&cursor="+encodeURIComponent(g.body.nextCursor!));ok(g.body.patients.map(x=>x.name).join("|")==="Carla Ruiz|Diego Peña"&&!!g.body.nextCursor,"PAGE_2_FOLLOWS_CURSOR");
 g=await get("limit=2&cursor="+encodeURIComponent(g.body.nextCursor!));ok(g.body.patients.map(x=>x.name).join("|")==="Elena Soto"&&g.body.nextCursor===null,"LAST_PAGE_NO_CURSOR");
 g=await get("limit=2&cursor=basura");ok(g.status===200&&g.body.patients.length===2,"INVALID_CURSOR_STARTS_OVER_NO_500");
 g=await get("limit=999999");ok(g.body.patients.length===5,"LIMIT_CLAMPED_TO_MAX");
 g=await get("q=ru");ok(g.body.patients.map(x=>x.name).join("|")==="Carla Ruiz","SEARCH_BY_NAME_WORD_PREFIX"); // "Ruiz" es la 2.ª palabra; "Bruno" contiene "ru" pero no empieza por él
 g=await get("q=or");ok(g.body.patients.map(x=>x.name).join("|")==="Bruno Ortiz","SEARCH_SECOND_WORD_PREFIX");
 g=await get("q=RUCA80");ok(g.body.patients.map(x=>x.name).join("|")==="Carla Ruiz","SEARCH_BY_CURP_PREFIX");
 g=await get("q=zzz");ok(g.body.patients.length===0&&g.body.total===5,"SEARCH_NO_MATCH_KEEPS_TOTAL");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
