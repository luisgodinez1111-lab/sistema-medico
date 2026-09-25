// EPIC S-DOCUMENTOS/BLOB — Evidencia física: adjuntos binarios (PHI) del repositorio de documentos en Vercel
// Blob PRIVADO. Crea paciente+documento, sube un archivo (multipart), verifica que el detalle refleja el adjunto,
// lo DESCARGA a través de la Function (bytes idénticos + content-type), rechaza tipo no permitido (400), exige
// scope (403), y ELIMINA el adjunto (borra el blob + evento ATTACHMENT_REMOVED). Determinista, RLS-scoped. vs Neon + Blob.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
if(!process.env.BLOB_READ_WRITE_TOKEN){console.log(JSON.stringify({status:"NOT_RUN",reason:"BLOB_READ_WRITE_TOKEN_MISSING"}));process.exit(3);}
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const docR=await import("../../apps/web/app/api/v1/documents/route");
const docGet=await import("../../apps/web/app/api/v1/documents/[documentId]/route");
const attR=await import("../../apps/web/app/api/v1/documents/[documentId]/attachments/route");
const attId=await import("../../apps/web/app/api/v1/documents/[documentId]/attachments/[attachmentId]/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","document:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
async function reg(t:string,p:string){await patR.POST(new Request("http://l/",{method:"POST",headers:{...H(t,{"idempotency-key":idem()}),"content-type":"application/json"},body:JSON.stringify({patientId:p,name:`Ana ${p.slice(0,8)}`,birthDate:"1986-01-01",sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function createDoc(t:string,d:string,p:string){await docR.POST(new Request("http://l/",{method:"POST",headers:{...H(t,{"idempotency-key":idem()}),"content-type":"application/json"},body:JSON.stringify({documentId:d,patientId:p,docType:"OTHER",title:"Estudio externo",content:"Contenido de la nota.",occurredAt:at()})}));}
async function attach(t:string,d:string,bytes:Uint8Array,filename:string,mime:string){const fd=new FormData();fd.append("file",new File([bytes],filename,{type:mime}));const r=await attR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:fd}),{params:Promise.resolve({documentId:d})});return{status:r.status,body:await r.json() as Record<string,unknown>};}
async function download(t:string,d:string,a:string){const r=await attId.GET(new Request("http://l/",{method:"GET",headers:H(t)}),{params:Promise.resolve({documentId:d,attachmentId:a})});const buf=r.status===200?new Uint8Array(await r.arrayBuffer()):new Uint8Array();return{status:r.status,ctype:r.headers.get("content-type"),bytes:buf};}
async function getDoc(t:string,d:string){const r=await docGet.GET(new Request("http://l/",{method:"GET",headers:H(t)}),{params:Promise.resolve({documentId:d})});return{status:r.status,body:await r.json() as Record<string,unknown>};}
async function remove(t:string,d:string,a:string){const r=await attId.DELETE(new Request("http://l/",{method:"DELETE",headers:H(t,{"idempotency-key":idem()})}),{params:Promise.resolve({documentId:d,attachmentId:a})});return{status:r.status,body:await r.json() as Record<string,unknown>};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();const p=crypto.randomUUID(),d=crypto.randomUUID();
 await reg(phys,p);await createDoc(phys,d,p);
 // contenido binario determinista (simula un PDF pequeño)
 const bytes=new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x34,0x0a,1,2,3,4,5,6,7,8,9,10,255,254,253]);
 const expectHash=crypto.createHash("sha256").update(bytes).digest("hex");
 // 1) subir adjunto (multipart) -> 201 + metadatos reales
 const a1=await attach(phys,d,bytes,"resultado laboratorio.pdf","application/pdf");
 ok(a1.status===201,"ATTACH_201");
 ok(a1.body.contentHash===expectHash,"ATTACH_HASH_MATCH");
 ok(a1.body.size===bytes.byteLength&&a1.body.mime==="application/pdf","ATTACH_META");
 ok(typeof a1.body.pathname==="string"&&String(a1.body.pathname).startsWith(`tenants/${TA}/documents/${d}/`),"ATTACH_TENANT_SCOPED_PATH");
 const aId=String(a1.body.attachmentId);
 // 2) el detalle del documento refleja el adjunto (sin volcar el binario)
 const g1=await getDoc(phys,d);
 ok(g1.status===200,"DOC_GET_200");
 const atts=(g1.body.attachments as Record<string,unknown>[]);
 ok(Array.isArray(atts)&&atts.length===1&&String(atts[0]!.attachmentId)===aId,"DETAIL_HAS_ATTACHMENT");
 ok(String(atts[0]!.pathname).length>0&&atts[0]!.size===bytes.byteLength,"DETAIL_ATTACHMENT_META");
 // 3) descarga a través de la Function -> bytes idénticos + content-type
 const dl=await download(phys,d,aId);
 ok(dl.status===200,"DOWNLOAD_200");
 ok(dl.ctype==="application/pdf","DOWNLOAD_CTYPE");
 ok(dl.bytes.byteLength===bytes.byteLength&&crypto.createHash("sha256").update(dl.bytes).digest("hex")===expectHash,"DOWNLOAD_BYTES_MATCH");
 // 4) tipo no permitido -> 400 (no persiste)
 const bad=await attach(phys,d,new Uint8Array([1,2,3]),"malicioso.exe","application/x-msdownload");
 ok(bad.status===400,"DISALLOWED_MIME_400");
 // 5) sin scope -> 403 (subida y descarga)
 const noScope=tok(["patient:read"]);
 const noAtt=await attach(noScope,d,bytes,"x.pdf","application/pdf");ok(noAtt.status===403,"ATTACH_MISSING_SCOPE_403");
 const noDl=await download(noScope,d,aId);ok(noDl.status===403,"DOWNLOAD_MISSING_SCOPE_403");
 // 6) eliminar adjunto -> el binario se borra y desaparece del detalle (append-only: el evento queda)
 const rm=await remove(phys,d,aId);ok(rm.status===200&&rm.body.removed===true,"REMOVE_200");
 const g2=await getDoc(phys,d);ok((g2.body.attachments as unknown[]).length===0,"DETAIL_ATTACHMENT_GONE");
 const dl2=await download(phys,d,aId);ok(dl2.status===404,"DOWNLOAD_AFTER_REMOVE_404");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
