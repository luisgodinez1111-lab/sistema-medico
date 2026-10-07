// EPIC N — Evidencia física del timeline del paciente (lectura/proyección RLS-scoped) contra Neon.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const open=await import("../../apps/web/app/api/v1/encounters/route");
const ords=await import("../../apps/web/app/api/v1/orders/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const timeline=await import("../../apps/web/app/api/v1/patients/[patientId]/timeline/route");
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const SCOPES=["patient:read","encounter:read","encounter:write","order:write","medication:propose","medication:write"];
function tok(t:string,scopes=SCOPES){return signSession({sub:crypto.randomUUID(),tenantId:t,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const TP=(id:string)=>({params:Promise.resolve({patientId:id})});const ISO="2026-07-07T07:00:00.000Z";const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok(TA);const pat=crypto.randomUUID();await ensurePatientIn(TA,pat); /* L-07 */
 // Crear 3 items para el mismo paciente
 await open.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:crypto.randomUUID(),patientId:pat,occurredAt:ISO})}));
 await ords.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({orderId:crypto.randomUUID(),patientId:pat,orderType:"LAB",detail:"Hemograma",occurredAt:ISO})}));
 await meds.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:crypto.randomUUID(),patientId:pat,drugCode:"amox",dose:"500mg",route:"VO",frequency:"c/8h",occurredAt:ISO})}));
 // Timeline
 let r:Response=await timeline.GET(new Request("http://l/",{headers:H(phys)}),TP(pat));
 const b=await r.json();
 ok(r.status===200,"TIMELINE_200");
 const types=(b.items||[]).map((x:{aggregateType:string})=>x.aggregateType).sort();
 ok(types.includes("Encounter")&&types.includes("ClinicalOrder")&&types.includes("Medication"),"TIMELINE_HAS_3_TYPES");
 ok((b.items||[]).length===3,"TIMELINE_EXACTLY_3_ITEMS");
 ok((b.items||[]).every((x:{latestKind:string})=>typeof x.latestKind==="string"&&x.latestKind.length>0),"TIMELINE_HAS_KINDS");
 // Auditoría S-08 — paginación por cursor: 3 agregados en páginas de 2, orden estable (más reciente primero), sin duplicados ni huecos
 r=await timeline.GET(new Request("http://l/?limit=2",{headers:H(phys)}),TP(pat));const p1=await r.json();
 ok(r.status===200&&p1.items.length===2&&typeof p1.nextCursor==="string","TIMELINE_PAGE_1_OF_2");
 r=await timeline.GET(new Request("http://l/?limit=2&cursor="+encodeURIComponent(p1.nextCursor),{headers:H(phys)}),TP(pat));const p2=await r.json();
 ok(p2.items.length===1&&p2.nextCursor===null,"TIMELINE_LAST_PAGE");
 const seen=[...p1.items,...p2.items].map((x:{aggregateId:string})=>x.aggregateId);
 ok(new Set(seen).size===3&&seen.sort().join()===(b.items as{aggregateId:string}[]).map(x=>x.aggregateId).sort().join(),"TIMELINE_PAGES_COVER_ALL_WITHOUT_DUPLICATES");
 // Cross-tenant: tenant B no ve nada de ese paciente
 const physB=tok(TB);
 r=await timeline.GET(new Request("http://l/",{headers:H(physB)}),TP(pat));
 ok(r.status===200&&(await r.json()).items.length===0,"CROSS_TENANT_EMPTY");
 // Sin scope patient:read -> 403
 const noScope=tok(TA,["encounter:read"]);
 r=await timeline.GET(new Request("http://l/",{headers:H(noScope)}),TP(pat));
 ok(r.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
