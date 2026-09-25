// EPIC Z — Evidencia física del consentimiento informado (redactar/presentar/otorgar/rechazar/revocar) contra Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatient,ensurePatientIn,freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const co=await import("../../apps/web/app/api/v1/consents/route");
const pre=await import("../../apps/web/app/api/v1/consents/[consentId]/presentation/route");
const gr=await import("../../apps/web/app/api/v1/consents/[consentId]/grant/route");
const de=await import("../../apps/web/app/api/v1/consents/[consentId]/decline/route");
const rev=await import("../../apps/web/app/api/v1/consents/[consentId]/revocation/route");
import{directEndpoint}from"../../packages/pg-endpoint/src";
const postgres=(await import("postgres")).default;
const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:2,prepare:false,onnotice:()=>{}});
const TA=crypto.randomUUID(),TB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(t:string,roles=["NURSE"],scopes=["consent:write"]){return signSession({sub:crypto.randomUUID(),tenantId:t,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({consentId:id})});const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
// R02a-CON-01: el consentimiento otorgado exige la huella del documento presentado, la modalidad y su artefacto.
const TEXTO="Consentimiento informado para el procedimiento X. Riesgos, alternativas y derecho a revocar.";
const HASH=crypto.createHash("sha256").update(TEXTO).digest("hex");
const FIRMA={documentHash:HASH,method:"ELECTRONIC_SIGNATURE",signatureArtifactRef:"blob://consents/firma-1.png"} as const;
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
async function mk(t:string){const id=crypto.randomUUID();const r=await co.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({consentId:id,patientId:await freshPatient(TA),scopeType:"PROCEDURE",documentRef:"CI-2026-001",occurredAt:ISO})}));return{id,r};}
const B=(t:string,v:number,body:Record<string,unknown>={})=>({method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})});
try{
 const nurse=tok(TA);
 // redactar -> presentar -> otorgar -> revocar
 let{id,r}=await mk(nurse);ok(r.status===201&&(await r.json()).state==="DRAFTED","DRAFT_201");
 r=await pre.POST(new Request("http://l/",B(nurse,1,{documentHash:HASH})),PP(id));ok(r.status===201&&(await r.json()).state==="PRESENTED","PRESENT_201");
// CON-01: sin huella del documento no se otorga…
 r=await gr.POST(new Request("http://l/",B(nurse,2,{signerName:"Juan Pérez"})),PP(id));ok(r.status===400,"OTORGAR_SIN_HUELLA_DEL_DOCUMENTO_400");
 // …ni con una huella distinta de la presentada (el documento cambió entre presentar y firmar)…
 r=await gr.POST(new Request("http://l/",B(nurse,2,{signerName:"Juan Pérez",...FIRMA,documentHash:crypto.createHash("sha256").update(TEXTO+" MODIFICADO").digest("hex")})),PP(id));
 const distinta=await r.json() as{error?:{details?:{conflictReason?:string}}};
 ok(r.status===409&&distinta.error?.details?.conflictReason==="CONSENT_DOCUMENT_MISMATCH","DOCUMENTO_DISTINTO_DEL_PRESENTADO_409");
 // …ni con firma electrónica sin el artefacto firmado…
 r=await gr.POST(new Request("http://l/",B(nurse,2,{signerName:"Juan Pérez",documentHash:HASH,method:"ELECTRONIC_SIGNATURE"})),PP(id));
 ok(r.status===400,"FIRMA_SIN_ARTEFACTO_400");
 // …ni verbal sin testigo.
 r=await gr.POST(new Request("http://l/",B(nurse,2,{signerName:"Juan Pérez",documentHash:HASH,method:"VERBAL_WITNESSED"})),PP(id));
 ok(r.status===400,"VERBAL_SIN_TESTIGO_400");
 // Con documento, modalidad y artefacto: se otorga.
 r=await gr.POST(new Request("http://l/",B(nurse,2,{signerName:"Juan Pérez",...FIRMA})),PP(id));ok(r.status===201&&(await r.json()).state==="GRANTED","GRANT_201");
 const evG=await sql`select payload from clinical_events where tenant_id=${TA} and aggregate_id=${id} order by sequence desc limit 1`;
 const pg=evG[0]!["payload"] as Record<string,unknown>;
 ok(pg["documentHash"]===HASH&&pg["method"]==="ELECTRONIC_SIGNATURE"&&pg["signatureArtifactRef"]==="blob://consents/firma-1.png","EL_EVENTO_GUARDA_DOCUMENTO_MODALIDAD_Y_ARTEFACTO");
 ok(pg["signerIdentityVerified"]===false,"NO_SE_FINGE_VERIFICACION_DE_IDENTIDAD");
 r=await rev.POST(new Request("http://l/",B(nurse,3,{reason:"Paciente retira consentimiento"})),PP(id));ok(r.status===201&&(await r.json()).state==="REVOKED","REVOKE_201");
 // SM: revocar tras revocar (terminal) -> 409
 r=await rev.POST(new Request("http://l/",B(nurse,4,{reason:"x"})),PP(id));ok(r.status===409,"REVOKE_TERMINAL_409");
 // SM: otorgar sin presentar -> 409
 const two=await mk(nurse);
 r=await gr.POST(new Request("http://l/",B(nurse,1,{signerName:"X",...FIRMA})),PP(two.id));ok(r.status===409,"GRANT_WITHOUT_PRESENT_409");
 // rechazo tras presentar
 const three=await mk(nurse);
 await pre.POST(new Request("http://l/",B(nurse,1)),PP(three.id));
 r=await de.POST(new Request("http://l/",B(nurse,2,{reason:"Paciente no acepta"})),PP(three.id));ok(r.status===201&&(await r.json()).state==="DECLINED","DECLINE_201");
 // SM: revocar un DECLINED (terminal) -> 409
 r=await rev.POST(new Request("http://l/",B(nurse,3,{reason:"x"})),PP(three.id));ok(r.status===409,"REVOKE_DECLINED_409");
 // cross-tenant -> 404
 const nurseB=tok(TB);
 r=await pre.POST(new Request("http://l/",B(nurseB,1)),PP(two.id));ok(r.status===404,"CROSS_TENANT_404");
 // sin scope consent:write -> 403
 const noScope=tok(TA,["NURSE"],["patient:read"]);
 r=await co.POST(new Request("http://l/",{method:"POST",headers:H(noScope,{"idempotency-key":idem()}),body:JSON.stringify({consentId:crypto.randomUUID(),patientId:await freshPatient(TA),scopeType:"TREATMENT",documentRef:"x",occurredAt:ISO})}));
 ok(r.status===403,"MISSING_WRITE_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
await sql.end({timeout:5});
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
