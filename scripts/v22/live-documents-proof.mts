// EPIC Z/UI — Evidencia física: documentos clínicos de un paciente (vista Documentos). Crea documentos de
// varios tipos, finaliza uno, y consulta GET /patients/:id/documents -> lista + tipo-UI + estado + conteos por
// carpeta. Determinista, RLS-scoped. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const docR=await import("../../apps/web/app/api/v1/documents/route");
const docFin=await import("../../apps/web/app/api/v1/documents/[documentId]/finalization/route");
const listR=await import("../../apps/web/app/api/v1/patients/[patientId]/documents/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","document:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Ana López García ${p.slice(0,8)}`,birthDate:birth(34),sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function doc(t:string,p:string,docType:string,title:string){const id=crypto.randomUUID();const r=await docR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({documentId:id,patientId:p,docType,title,content:"Contenido del documento.",occurredAt:at()})}));return{id,status:r.status};}
async function finalize(t:string,id:string){return docFin.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({documentId:id})});}
async function list(t:string,p:string){const r=await listR.GET(new Request("http://l/",{method:"GET",headers:H(t)}),{params:Promise.resolve({patientId:p})});return{status:r.status,body:await r.json()};}
const{result,ok,fin}=libro();
try{
 const phys=tok();const p=crypto.randomUUID();await reg(phys,p);
 const d1=await doc(phys,p,"PROGRESS_NOTE","Nota_consulta_15082026.pdf");
 await doc(phys,p,"PROGRESS_NOTE","Nota_evolucion.pdf");
 await doc(phys,p,"REFERRAL","Interconsulta_Endocrinologia.pdf");
 await doc(phys,p,"PROCEDURE_NOTE","Nota_procedimiento.pdf");
 ok(d1.status===201,"CREATE_201");
 const fr=await finalize(phys,d1.id);ok(fr.status===200||fr.status===201,"FINALIZE_OK");

 const L=await list(phys,p);ok(L.status===200,"LIST_200");
 const b=L.body as{total:number;items:{title:string;typeLabel:string;statusLabel:string;status:string}[];byType:Record<string,number>;chips:{clinical:number}};
 ok(b.total===4,"TOTAL_4");
 // tipo-UI derivado del docType
 ok(b.items.find(x=>x.title==="Interconsulta_Endocrinologia.pdf")?.typeLabel==="Interconsulta","TYPE_REFERRAL");
 ok(b.items.find(x=>x.title==="Nota_consulta_15082026.pdf")?.typeLabel==="Nota médica","TYPE_NOTE");
 ok(b.items.find(x=>x.title==="Nota_procedimiento.pdf")?.typeLabel==="Procedimiento","TYPE_PROCEDURE");
 // conteos por carpeta
 ok(b.byType["Nota médica"]===2&&b.byType["Interconsulta"]===1&&b.byType["Procedimiento"]===1,"FOLDER_COUNTS");
 // chip de documentos clínicos (PROGRESS_NOTE + PROCEDURE_NOTE + DISCHARGE) = 3
 ok(b.chips.clinical===3,"CHIP_CLINICAL_3");
 // estado tras finalizar
 ok(b.items.find(x=>x.title==="Nota_consulta_15082026.pdf")?.statusLabel==="Finalizado","STATUS_FINALIZED");

 // sin scope -> 403
 const noScope=await list(tok(["patient:read"]),p);
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
