// EPIC Z/UI — Evidencia física: repositorio de documentos (GET /api/v1/documents/:id). Crea un documento,
// lo finaliza, lo FIRMA (physician) y lo ENMIENDA (addendum append-only); luego GET devuelve el CONTENIDO real,
// el estado, la firma (contentHash/signatureDigest) y la adenda. Mas 404 (inexistente) y 403 (sin scope). vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-z-docdetail-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const docR=await import("../../apps/web/app/api/v1/documents/route");
const finR=await import("../../apps/web/app/api/v1/documents/[documentId]/finalization/route");
const sigR=await import("../../apps/web/app/api/v1/documents/[documentId]/signature/route");
const amdR=await import("../../apps/web/app/api/v1/documents/[documentId]/amendment/route");
const getR=await import("../../apps/web/app/api/v1/documents/[documentId]/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","document:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Ana López García ${p.slice(0,8)}`,birthDate:birth(34),sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function create(t:string,p:string){const id=crypto.randomUUID();const r=await docR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({documentId:id,patientId:p,docType:"PROGRESS_NOTE",title:"Nota de evolución 01/09/2026",content:"Paciente estable. Continúa tratamiento.",occurredAt:at()})}));return{id,status:r.status};}
async function finalize(t:string,id:string,v:number){return finR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({documentId:id})});}
// Auditoría L-03: la firma exige la huella (sha256) del contenido que el cliente muestra.
async function sign(t:string,id:string,v:number){return sigR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:at(),contentHash:crypto.createHash("sha256").update("Paciente estable. Continúa tratamiento.").digest("hex")})}),{params:Promise.resolve({documentId:id})});}
async function amend(t:string,id:string,v:number){return amdR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({addendum:"Se agrega resultado de laboratorio.",occurredAt:at()})}),{params:Promise.resolve({documentId:id})});}
async function get(t:string,id:string){const r=await getR.GET(new Request("http://l/",{method:"GET",headers:H(t)}),{params:Promise.resolve({documentId:id})});return{status:r.status,body:await r.json()};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();await registerPhysicianCredentials(phys);const pid=crypto.randomUUID();await reg(phys,pid);
 const c=await create(phys,pid);ok(c.status===201,"CREATE_201");
 ok((await finalize(phys,c.id,1)).status===201,"FINALIZE_201");   // v1 -> FINALIZED (v2)
 ok((await sign(phys,c.id,2)).status===201,"SIGN_201");           // v2 -> SIGNED (v3)
 ok((await amend(phys,c.id,3)).status===201,"AMEND_201");         // v3 -> AMENDED (v4)
 const g=await get(phys,c.id);ok(g.status===200,"GET_200");
 const b=g.body as{exists:boolean;content:string;state:string;version:number;title:string;patientId:string;signature:{contentHash:string;signatureDigest:string}|null;addenda:{addendum:string}[];statusLabel:string};
 ok(b.exists===true,"EXISTS");
 ok(b.content==="Paciente estable. Continúa tratamiento.","CONTENT_REAL");        // contenido real, no maqueta
 ok(b.title==="Nota de evolución 01/09/2026"&&b.patientId===pid,"METADATA_REAL");
 ok(b.state==="AMENDED"&&b.statusLabel==="Enmendado","STATE_AMENDED");
 ok(b.version===4,"VERSION_4");
 ok(!!b.signature&&b.signature.contentHash.length===64&&b.signature.signatureDigest.length===64,"SIGNATURE_PRESENT");
 ok(b.addenda.length===1&&b.addenda[0]!.addendum==="Se agrega resultado de laboratorio.","ADDENDUM_APPENDED");
 // documento inexistente -> 404
 ok((await get(phys,crypto.randomUUID())).status===404,"UNKNOWN_404");
 // sin scope -> 403
 ok((await get(tok(["patient:read"]),c.id)).status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
