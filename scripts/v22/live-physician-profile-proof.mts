// EPIC S-CONFIG/FIRMA — Evidencia física: firma y sello del médico (perfil por-usuario) en Vercel Blob PRIVADO.
// GET perfil (vacío) -> sube firma (imagen) -> el perfil refleja los metadatos -> descarga (bytes idénticos) ->
// sube sello -> re-sube firma (nuevo hash, misma ruta) -> tipo no permitido (400) -> sin scope (403) -> kind
// desconocido (404) -> quita firma (blob borrado + ASSET_REMOVED; sello sigue). Determinista, RLS-scoped. vs Neon + Blob.
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
if(!process.env.BLOB_READ_WRITE_TOKEN){console.log(JSON.stringify({status:"NOT_RUN",reason:"BLOB_READ_WRITE_TOKEN_MISSING"}));process.exit(3);}
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const profR=await import("../../apps/web/app/api/v1/physician-profile/route");
const assetR=await import("../../apps/web/app/api/v1/physician-profile/assets/[kind]/route");
const TA=crypto.randomUUID();const SUB=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["settings:write"],sub=SUB){return signSession({sub,tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{authorization:"Bearer "+t,...x};}
async function getProfile(t:string){const r=await profR.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json() as Record<string,unknown>};}
async function upload(t:string,kind:string,bytes:Uint8Array,filename:string,mime:string){const fd=new FormData();fd.append("file",new File([bytes as unknown as BlobPart],filename,{type:mime}));const r=await assetR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":crypto.randomUUID()}),body:fd}),{params:Promise.resolve({kind})});return{status:r.status,body:await r.json() as Record<string,unknown>};}
async function download(t:string,kind:string){const r=await assetR.GET(new Request("http://l/",{method:"GET",headers:H(t)}),{params:Promise.resolve({kind})});const buf=r.status===200?new Uint8Array(await r.arrayBuffer()):new Uint8Array();return{status:r.status,ctype:r.headers.get("content-type"),bytes:buf};}
async function remove(t:string,kind:string){const r=await assetR.DELETE(new Request("http://l/",{method:"DELETE",headers:H(t,{"idempotency-key":crypto.randomUUID()})}),{params:Promise.resolve({kind})});return{status:r.status,body:await r.json() as Record<string,unknown>};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
// PNG mínimo (firma) y otro distinto (sello) — solo importan bytes/mime deterministas.
const sig=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3,4,5,6,7,8]);
const stamp=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,9,9,9,9,9,9]);
const sig2=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,42,42,42]);
const hash=(b:Uint8Array)=>crypto.createHash("sha256").update(b).digest("hex");
try{
 const phys=tok();
 // 1) perfil inicial vacío
 const g0=await getProfile(phys);ok(g0.status===200,"GET_200");
 ok(g0.body.signature===null&&g0.body.stamp===null&&g0.body.version===0,"EMPTY_PROFILE");
 // 2) subir firma
 const u1=await upload(phys,"signature",sig,"firma.png","image/png");
 ok(u1.status===201&&u1.body.version===1,"SIGNATURE_UPLOAD_201");
 ok(u1.body.contentHash===hash(sig)&&u1.body.mime==="image/png","SIGNATURE_META");
 // 3) el perfil refleja la firma (sin binario)
 const g1=await getProfile(phys);
 ok(g1.body.signature!==null&&(g1.body.signature as{contentHash:string}).contentHash===hash(sig)&&g1.body.stamp===null,"PROFILE_HAS_SIGNATURE");
 // 4) descarga -> bytes idénticos + content-type
 const d1=await download(phys,"signature");
 ok(d1.status===200&&d1.ctype==="image/png"&&hash(d1.bytes)===hash(sig),"SIGNATURE_DOWNLOAD_MATCH");
 // 5) subir sello -> ambos presentes
 const u2=await upload(phys,"stamp",stamp,"sello.png","image/png");
 ok(u2.status===201&&u2.body.version===2,"STAMP_UPLOAD_201");
 const g2=await getProfile(phys);ok(g2.body.signature!==null&&g2.body.stamp!==null,"PROFILE_HAS_BOTH");
 // 6) re-subir firma (misma ruta, nuevo contenido) -> hash actualizado
 const u3=await upload(phys,"signature",sig2,"firma.png","image/png");
 ok(u3.status===201&&u3.body.version===3&&u3.body.contentHash===hash(sig2),"SIGNATURE_REUPLOAD");
 const d3=await download(phys,"signature");ok(hash(d3.bytes)===hash(sig2),"SIGNATURE_REUPLOAD_BYTES");
 // 7) tipo no permitido (PDF en firma) -> 400
 const bad=await upload(phys,"signature",new Uint8Array([1,2,3]),"x.pdf","application/pdf");
 ok(bad.status===400,"DISALLOWED_MIME_400");
 // 8) kind desconocido -> 404
 const badKind=await upload(phys,"logo",sig,"x.png","image/png");
 ok(badKind.status===404,"UNKNOWN_KIND_404");
 // 9) sin scope -> 403 (subida y descarga)
 const ns=tok(["patient:read"]);
 ok((await upload(ns,"signature",sig,"x.png","image/png")).status===403,"UPLOAD_MISSING_SCOPE_403");
 ok((await download(ns,"signature")).status===403,"DOWNLOAD_MISSING_SCOPE_403");
 // 10) otro médico (otro sub) ve su propio perfil vacío (aislamiento por usuario dentro del tenant)
 const g_other=await getProfile(tok(["settings:write"],crypto.randomUUID()));
 ok(g_other.body.signature===null&&g_other.body.version===0,"PER_USER_ISOLATION");
 // 11) quitar firma -> blob borrado, ASSET_REMOVED; el sello sigue
 const rm=await remove(phys,"signature");ok(rm.status===200&&rm.body.removed===true,"REMOVE_200");
 const g4=await getProfile(phys);ok(g4.body.signature===null&&g4.body.stamp!==null,"SIGNATURE_GONE_STAMP_STAYS");
 ok((await download(phys,"signature")).status===404,"DOWNLOAD_AFTER_REMOVE_404");
 // limpieza: quitar sello
 await remove(phys,"stamp");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
