// Hallazgo D3 del lote 11 — Evidencia física: adjuntar o quitar un archivo es una ANOTACIÓN del documento (el estado no
// cambia; la versión sí). Antes el fold no conocía ATTACHED/ATTACHMENT_REMOVED: un documento con adjunto respondía 500 al
// finalizar, firmar o enmendar (incluso tras quitar el adjunto) y la lista mostraba un documento firmado como «Borrador».
// Usa los handlers REALES de adjuntos con la API de Vercel Blob sustituida por un servidor HTTP local. vs Neon.
import crypto from"node:crypto";import http from"node:http";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const server=http.createServer((req,res)=>{req.resume();req.on("end",()=>{const u=new URL(req.url??"/","http://x");const pathname=u.searchParams.get("pathname")??"";res.setHeader("content-type","application/json");
 res.end(req.method==="PUT"?JSON.stringify({url:`https://store.private.blob.vercel-storage.com/${pathname}`,downloadUrl:`https://store.private.blob.vercel-storage.com/${pathname}?download=1`,pathname,contentType:"application/pdf",contentDisposition:"inline"}):"{}");});});
await new Promise<void>(r=>server.listen(0,"127.0.0.1",()=>r()));
process.env.VERCEL_BLOB_API_URL=`http://127.0.0.1:${(server.address() as{port:number}).port}`;process.env.BLOB_READ_WRITE_TOKEN="vercel_blob_rw_localstub_secretsecret";process.env.VERCEL_BLOB_RETRIES="0";
const SECRET=process.env.SESSION_SIGNING_SECRET; // R11-07: el prólogo (_live-env) fija un secreto aleatorio por corrida
const{signSession}=await import("../../packages/session/src");
const{ensurePatientIn}=await import("./_patient.mts");
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts");
const docs=await import("../../apps/web/app/api/v1/documents/route");
const docGet=await import("../../apps/web/app/api/v1/documents/[documentId]/route");
const fin=await import("../../apps/web/app/api/v1/documents/[documentId]/finalization/route");
const sig=await import("../../apps/web/app/api/v1/documents/[documentId]/signature/route");
const amd=await import("../../apps/web/app/api/v1/documents/[documentId]/amendment/route");
const attR=await import("../../apps/web/app/api/v1/documents/[documentId]/attachments/route");
const attId=await import("../../apps/web/app/api/v1/documents/[documentId]/attachments/[attachmentId]/route");
const listR=await import("../../apps/web/app/api/v1/patients/[patientId]/documents/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const phys=signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes:["document:write","document:read","patient:write"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
const H=(x:Record<string,string>={})=>({"content-type":"application/json",authorization:"Bearer "+phys,...x});
const DP=(id:string)=>({params:Promise.resolve({documentId:id})});const idem=()=>crypto.randomUUID();const ISO=new Date().toISOString();
const CONTENT="Nota de evolución con estudio adjunto.";const HASH=crypto.createHash("sha256").update(CONTENT).digest("hex");
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
type Mod={POST:(r:Request,p:ReturnType<typeof DP>)=>Promise<Response>};
const step=(m:Mod,d:string,v:number,body:Record<string,unknown>)=>m.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:ISO,...body})}),DP(d));
try{
 await registerPhysicianCredentials(phys);const patient=crypto.randomUUID();await ensurePatientIn(TA,patient);
 const listed=async(d:string)=>((await(await listR.GET(new Request("http://l/",{headers:H()}),{params:Promise.resolve({patientId:patient})})).json()).items as{documentId:string;status:string}[]).find(i=>i.documentId===d)?.status;
 const detail=async(d:string)=>(await(await docGet.GET(new Request("http://l/",{headers:H()}),DP(d))).json()) as{state:string;version:number;attachments:unknown[]};
 const d=crypto.randomUUID();
 ok((await docs.POST(new Request("http://l/",{method:"POST",headers:H({"idempotency-key":idem()}),body:JSON.stringify({documentId:d,patientId:patient,docType:"PROGRESS_NOTE",title:"Nota con estudio",content:CONTENT,occurredAt:ISO})}))).status===201,"DOCUMENT_CREATED");
 const fd=new FormData();fd.append("file",new File([new Uint8Array([0x25,0x50,0x44,0x46,1,2,3])],"lab.pdf",{type:"application/pdf"}));
 const att=await attR.POST(new Request("http://l/",{method:"POST",headers:{authorization:"Bearer "+phys,"idempotency-key":idem()},body:fd}),DP(d));
 const attBody=await att.json() as{attachmentId:string;version:number};ok(att.status===201&&attBody.version===2,"ATTACHED_WITH_REAL_HANDLER");
 ok((await step(fin,d,2,{})).status===201,"DRAFT_WITH_ATTACHMENT_FINALIZES");
 ok((await step(sig,d,3,{contentHash:HASH})).status===201,"FINALIZED_WITH_ATTACHMENT_SIGNS");
 ok(await listed(d)==="SIGNED"&&(await detail(d)).state==="SIGNED","LIST_AND_DETAIL_SHOW_SIGNED");
 const rm=await attId.DELETE(new Request("http://l/",{method:"DELETE",headers:{authorization:"Bearer "+phys,"idempotency-key":idem()}}),{params:Promise.resolve({documentId:d,attachmentId:attBody.attachmentId})});
 const after=await detail(d);ok(rm.status===200&&after.state==="SIGNED"&&after.attachments.length===0&&after.version===5&&await listed(d)==="SIGNED","REMOVAL_KEEPS_SIGNED_STATE");
 ok((await step(amd,d,5,{addendum:"Adenda posterior al estudio"})).status===201&&await listed(d)==="AMENDED","AMENDS_AFTER_ATTACHMENT_REMOVAL");
}catch(e){result.status="FAIL";result.error=String(e);}
server.close();
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
