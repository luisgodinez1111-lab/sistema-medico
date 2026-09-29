// Hallazgo D6 del lote 11 — Evidencia física: los comandos con efectos en Vercel Blob reconocen el REINTENTO antes de tocar el
// almacén y nunca borran un binario que un evento confirmado cita. Antes, reintentar un adjunto con la misma Idempotency-Key
// volvía a subirlo a la misma ruta, el kernel respondía 409 y la limpieza BORRABA el blob que el evento seguía citando (descarga
// 404); dos envíos simultáneos con la misma llave hacían lo mismo, y la imagen del perfil se sobrescribía antes del commit.
// Usa los handlers REALES con la API de Blob sustituida por un servidor HTTP local que registra subidas y borrados. vs Neon.
import crypto from"node:crypto";import http from"node:http";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const puts:string[]=[],dels:string[]=[];
const server=http.createServer((req,res)=>{const chunks:Buffer[]=[];req.on("data",c=>chunks.push(c));req.on("end",()=>{
 const u=new URL(req.url??"/","http://x");const pathname=u.searchParams.get("pathname")??"";res.setHeader("content-type","application/json");
 if(req.method==="PUT"){puts.push(pathname);res.end(JSON.stringify({url:`https://store.private.blob.vercel-storage.com/${pathname}`,downloadUrl:`https://store.private.blob.vercel-storage.com/${pathname}?download=1`,pathname,contentType:"application/pdf",contentDisposition:"inline"}));return;}
 if(u.pathname.endsWith("/delete")){const b=Buffer.concat(chunks).toString();try{for(const x of(JSON.parse(b).urls??[]) as string[])dels.push(x.replace(/^https?:\/\/[^/]+\//,"").replace(/\?.*$/,""));}catch{dels.push(b);}}
 res.end("{}");});});
await new Promise<void>(r=>server.listen(0,"127.0.0.1",()=>r()));
process.env.VERCEL_BLOB_API_URL=`http://127.0.0.1:${(server.address() as{port:number}).port}`;process.env.BLOB_READ_WRITE_TOKEN="vercel_blob_rw_localstub_secretsecret";process.env.VERCEL_BLOB_RETRIES="0";
const SECRET=process.env.SESSION_SIGNING_SECRET!; // R11-07: el secreto lo genera el prólogo (_live-env)
const{signSession}=await import("../../packages/session/src");
const{ensurePatientIn}=await import("./_patient.mts");
const docs=await import("../../apps/web/app/api/v1/documents/route");
const docGet=await import("../../apps/web/app/api/v1/documents/[documentId]/route");
const attR=await import("../../apps/web/app/api/v1/documents/[documentId]/attachments/route");
const attId=await import("../../apps/web/app/api/v1/documents/[documentId]/attachments/[attachmentId]/route");
const assetR=await import("../../apps/web/app/api/v1/physician-profile/assets/[kind]/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const phys=signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes:["document:write","document:read","patient:write","settings:write","settings:read"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
const DP=(id:string)=>({params:Promise.resolve({documentId:id})});const idem=()=>crypto.randomUUID();
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const file=(b:number[],name="lab.pdf",type="application/pdf")=>{const fd=new FormData();fd.append("file",new File([new Uint8Array(b)],name,{type}));return fd;};
type Att={attachmentId:string;pathname:string;replayed:boolean;version:number;error?:{code:string}};
async function attach(d:string,key:string,bytes:number[]){const r=await attR.POST(new Request("http://l/",{method:"POST",headers:{authorization:"Bearer "+phys,"idempotency-key":key},body:file(bytes)}),DP(d));return{status:r.status,body:await r.json() as Att};}
const PDF=[0x25,0x50,0x44,0x46,1,2,3],PDF2=[0x25,0x50,0x44,0x46,9,9,9];
try{
 const patient=crypto.randomUUID();await ensurePatientIn(TA,patient);
 const newDoc=async()=>{const d=crypto.randomUUID();const r=await docs.POST(new Request("http://l/",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+phys,"idempotency-key":idem()},body:JSON.stringify({documentId:d,patientId:patient,docType:"PROGRESS_NOTE",title:"Estudio",content:"Nota",occurredAt:new Date().toISOString()})}));if(r.status!==201)throw new Error("DOC_"+r.status);return d;};
 const listedPath=async(d:string)=>((await(await docGet.GET(new Request("http://l/",{headers:{authorization:"Bearer "+phys}}),DP(d))).json()).attachments as{pathname:string}[]).map(a=>a.pathname);
 // A) Reintento con la MISMA llave tras un éxito: 200 con la respuesta original, sin volver a subir ni borrar nada.
 const d=await newDoc();const K=idem();
 const a1=await attach(d,K,PDF);ok(a1.status===201,"ATTACHED_201");
 const p1=a1.body.pathname;const putsAfter=puts.length;
 const a2=await attach(d,K,PDF);
 ok(a2.status===200&&a2.body.replayed===true&&a2.body.pathname===p1&&a2.body.attachmentId===a1.body.attachmentId&&a2.body.version===a1.body.version,"RETRY_SAME_KEY_REPLAYS_ORIGINAL_200");
 ok(puts.length===putsAfter&&!dels.includes(p1)&&(await listedPath(d)).includes(p1),"RETRY_TOUCHES_NO_BLOB_AND_KEEPS_REFERENCED_ONE");
 // B) Misma llave con OTRO archivo: conflicto de idempotencia, sin tocar el almacén.
 const a3=await attach(d,K,PDF2);ok(a3.status===409&&a3.body.error?.code==="IDEMPOTENCY_CONFLICT"&&puts.length===putsAfter&&!dels.includes(p1),"SAME_KEY_OTHER_FILE_409_NO_BLOB_TOUCHED");
 // C) Otra llave: ruta ÚNICA (nunca sobrescribe el binario de otro adjunto).
 const a4=await attach(d,idem(),PDF);ok(a4.status===201&&a4.body.pathname!==p1,"UNIQUE_PATH_PER_UPLOAD");
 // D) Dos envíos SIMULTÁNEOS con la misma llave: uno confirma; el otro solo borra SU propio binario, nunca el citado.
 const d2=await newDoc();const K2=idem();const[x,y]=await Promise.all([attach(d2,K2,PDF),attach(d2,K2,PDF)]);
 const cited=await listedPath(d2);
 ok(cited.length===1&&[x.status,y.status].includes(201)&&!dels.includes(cited[0]!),"CONCURRENT_DUPLICATE_NEVER_DELETES_CITED_BLOB");
 // E) Reintento de una retirada ya aplicada: 200 con la respuesta original (antes 404).
 const rmReq=(key:string)=>attId.DELETE(new Request("http://l/",{method:"DELETE",headers:{authorization:"Bearer "+phys,"idempotency-key":key}}),{params:Promise.resolve({documentId:d,attachmentId:a4.body.attachmentId})});
 const RK=idem();const r1=await rmReq(RK);const r2=await rmReq(RK);const r2b=await r2.json() as{replayed:boolean};
 ok(r1.status===200&&r2.status===200&&r2b.replayed===true&&dels.includes(a4.body.pathname),"REMOVAL_RETRY_REPLAYS_200");
 // F) Perfil del médico: el reintento no vuelve a subir y una imagen nueva no sobrescribe la vigente.
 const up=(key:string,b:number[])=>assetR.POST(new Request("http://l/",{method:"POST",headers:{authorization:"Bearer "+phys,"idempotency-key":key},body:file(b,"firma.png","image/png")}),{params:Promise.resolve({kind:"signature"})});
 const SK=idem();const before=puts.length;const s1=await up(SK,[0x89,0x50,0x4e,0x47,1]);const s2=await up(SK,[0x89,0x50,0x4e,0x47,1]);
 ok(s1.status===201&&s2.status===200&&((await s2.json()) as{replayed:boolean}).replayed===true&&puts.length===before+1,"PROFILE_RETRY_REPLAYS_WITHOUT_UPLOAD");
 // La imagen nueva va a OTRA ruta (nunca sobrescribe la vigente antes del commit). Que la reemplazada se retire del almacén
 // DESPUÉS del commit lo prueba live-review-blob-effects-proof (revisión adversarial del lote 11).
 const s3=await up(idem(),[0x89,0x50,0x4e,0x47,2]);const firstPath=puts[before]!;
 ok(s3.status===201&&puts[puts.length-1]!==firstPath,"PROFILE_NEW_IMAGE_NEVER_OVERWRITES_PREVIOUS");
}catch(e){result.status="FAIL";result.error=String(e);}
server.close();
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
