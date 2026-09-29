// Revisión adversarial del lote 11 (D6) — Evidencia física de los efectos en Vercel Blob que la revisión confirmó:
// (A) si el borrado del binario de un adjunto retirado falla después del evento, el REINTENTO de la retirada lo repite (antes
// respondía «removed» sin tocar el almacén y el PHI quedaba guardado para siempre); (B) una imagen del perfil REEMPLAZADA se
// retira del almacén después del commit, un reemplazo que no se confirma no toca la vigente, y retirar la firma borra todas las
// de ese tipo (antes las rutas únicas de D6 conservaban cada firma anterior indefinidamente); (C) dos envíos IDÉNTICOS
// simultáneos con la misma llave: el perdedor recibe el replay (200), no un 409, y su binario se descarta.
// Usa los handlers REALES con la API de Blob sustituida por un servidor HTTP local que guarda, retiene y borra. vs Neon.
import crypto from"node:crypto";import http from"node:http";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const stored=new Set<string>(),puts:string[]=[],delAttempts=new Map<string,number>(),failNextDelete=new Set<string>();
let holdPuts=0;let held:(()=>void)[]=[];const releaseHeld=()=>{const h=held;held=[];h.forEach(f=>f());};
const server=http.createServer((req,res)=>{const chunks:Buffer[]=[];req.on("data",c=>chunks.push(c));req.on("end",()=>{
 const u=new URL(req.url??"/","http://x");const pathname=u.searchParams.get("pathname")??"";res.setHeader("content-type","application/json");
 if(req.method==="PUT"){const respond=()=>{puts.push(pathname);stored.add(pathname);res.end(JSON.stringify({url:`https://store.private.blob.vercel-storage.com/${pathname}`,downloadUrl:`https://store.private.blob.vercel-storage.com/${pathname}?download=1`,pathname,contentType:"application/octet-stream",contentDisposition:"inline"}));};
  if(holdPuts>0){holdPuts--;held.push(respond);return;}respond();return;}
 if(u.pathname.endsWith("/delete")){let urls:string[]=[];try{urls=(JSON.parse(Buffer.concat(chunks).toString()).urls??[]) as string[];}catch{/* cuerpo inesperado */}
  const paths=urls.map(x=>x.replace(/^https?:\/\/[^/]+\//,"").replace(/\?.*$/,""));
  for(const p of paths)delAttempts.set(p,(delAttempts.get(p)??0)+1);
  if(paths.some(p=>failNextDelete.delete(p))){res.statusCode=500;res.end(JSON.stringify({error:{code:"internal_server_error",message:"falla simulada"}}));return;}
  for(const p of paths)stored.delete(p);}
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
const until=async(cond:()=>boolean)=>{for(let i=0;i<200&&!cond();i++)await new Promise(r=>setTimeout(r,25));return cond();};
const file=(b:number[],name="lab.pdf",type="application/pdf")=>{const fd=new FormData();fd.append("file",new File([new Uint8Array(b)],name,{type}));return fd;};
type Att={attachmentId:string;pathname:string;replayed:boolean;error?:{code:string}};
async function attach(d:string,key:string,bytes:number[]){const r=await attR.POST(new Request("http://l/",{method:"POST",headers:{authorization:"Bearer "+phys,"idempotency-key":key},body:file(bytes)}),DP(d));return{status:r.status,body:await r.json() as Att};}
const PDF=[0x25,0x50,0x44,0x46,1,2,3];
const png=(n:number)=>[0x89,0x50,0x4e,0x47,n];
const upload=async(kind:string,key:string,b:number[])=>{const before=puts.length;const r=await assetR.POST(new Request("http://l/",{method:"POST",headers:{authorization:"Bearer "+phys,"idempotency-key":key},body:file(b,`${kind}.png`,"image/png")}),{params:Promise.resolve({kind})});return{status:r.status,path:puts.slice(before).at(-1)??""};};
try{
 const patient=crypto.randomUUID();await ensurePatientIn(TA,patient);
 const newDoc=async()=>{const d=crypto.randomUUID();const r=await docs.POST(new Request("http://l/",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+phys,"idempotency-key":idem()},body:JSON.stringify({documentId:d,patientId:patient,docType:"PROGRESS_NOTE",title:"Estudio",content:"Nota",occurredAt:new Date().toISOString()})}));if(r.status!==201)throw new Error("DOC_"+r.status);return d;};
 const listedPath=async(d:string)=>((await(await docGet.GET(new Request("http://l/",{headers:{authorization:"Bearer "+phys}}),DP(d))).json()).attachments as{pathname:string}[]).map(a=>a.pathname);
 // (A) Retirada cuyo borrado del binario falla después del evento: el reintento con la misma llave lo repite.
 const d=await newDoc();const a=await attach(d,idem(),PDF);const P=a.body.pathname;ok(a.status===201&&stored.has(P),"ATTACHED_AND_STORED");
 failNextDelete.add(P);
 const rm=(key:string)=>attId.DELETE(new Request("http://l/",{method:"DELETE",headers:{authorization:"Bearer "+phys,"idempotency-key":key}}),{params:Promise.resolve({documentId:d,attachmentId:a.body.attachmentId})});
 const RK=idem();const r1=await rm(RK);
 ok(r1.status===200&&delAttempts.get(P)===1&&stored.has(P)&&!(await listedPath(d)).includes(P),"REMOVED_FROM_RECORD_BUT_BLOB_DELETE_FAILED");
 const r2=await rm(RK);const r2b=await r2.json() as{replayed?:boolean};
 ok(r2.status===200&&r2b.replayed===true&&delAttempts.get(P)===2&&!stored.has(P),"REMOVAL_REPLAY_RETRIES_BLOB_DELETE");
 // (B) Perfil del médico: el reemplazo confirmado retira la imagen anterior; uno que no se confirma no toca la vigente.
 const stamp=await upload("stamp",idem(),png(9));
 const sA=await upload("signature",idem(),png(1));const sB=await upload("signature",idem(),png(2));
 ok(sA.status===201&&sB.status===201&&!stored.has(sA.path)&&stored.has(sB.path),"PROFILE_REPLACED_IMAGE_RETIRED_AFTER_COMMIT");
 holdPuts=1;const pendingC=upload("signature",idem(),png(3)); // lee la versión del perfil y queda retenido en la subida
 ok(await until(()=>held.length===1),"STALE_REPLACEMENT_HELD_IN_UPLOAD");
 const sD=await upload("signature",idem(),png(4)); // otro reemplazo se confirma mientras tanto
 releaseHeld();const sC=await pendingC;
 ok(sD.status===201&&sC.status===409&&stored.has(sD.path)&&!stored.has(sC.path)&&!stored.has(sB.path),"UNCONFIRMED_REPLACEMENT_KEEPS_CURRENT_IMAGE");
 const rmSig=await assetR.DELETE(new Request("http://l/",{method:"DELETE",headers:{authorization:"Bearer "+phys,"idempotency-key":idem()}}),{params:Promise.resolve({kind:"signature"})});
 ok(rmSig.status===200&&[sA,sB,sC,sD].every(s=>!stored.has(s.path))&&[sA.path,sB.path,sD.path].every(p=>(delAttempts.get(p)??0)>=1),"PROFILE_REMOVAL_RETIRES_EVERY_IMAGE_OF_KIND");
 ok(stamp.status===201&&stored.has(stamp.path),"PROFILE_REMOVAL_KEEPS_OTHER_KIND");
 // (C) Dos adjuntos IDÉNTICOS simultáneos con la misma llave: uno confirma (201) y el otro recibe su replay (200).
 const d2=await newDoc();const K2=idem();holdPuts=2;
 const both=Promise.all([attach(d2,K2,PDF),attach(d2,K2,PDF)]);
 ok(await until(()=>held.length===2),"BOTH_IDENTICAL_UPLOADS_OVERLAP");
 releaseHeld();const[x,y]=await both;const cited=await listedPath(d2);
 const statuses=[x.status,y.status].sort();const loser=[x,y].find(z=>z.status===200);
 ok(statuses[0]===200&&statuses[1]===201&&loser?.body.replayed===true&&x.body.attachmentId===y.body.attachmentId&&x.body.pathname===y.body.pathname,"CONCURRENT_IDENTICAL_ATTACH_REPLAYS_200");
 const extra=puts.filter(p=>p.startsWith(`tenants/${TA}/documents/${d2}/`)&&p!==cited[0]);
 ok(cited.length===1&&stored.has(cited[0]!)&&extra.length===1&&!stored.has(extra[0]!),"CONCURRENT_LOSER_BLOB_DISCARDED");
}catch(e){result.status="FAIL";result.error=String(e);}
server.close();
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
