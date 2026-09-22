// EPIC E/UI — Evidencia física: registro de órdenes/solicitudes de estudio de toda la clínica (Resultados ›
// Solicitudes). Crea órdenes de varios tipos, coloca y cumple algunas, y consulta GET /orders -> tipo-UI +
// estado por transición + join del paciente + conteos. RLS-scoped. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-e-ord-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const ordR=await import("../../apps/web/app/api/v1/orders/route");
const ordPlace=await import("../../apps/web/app/api/v1/orders/[orderId]/placement/route");
const ordFul=await import("../../apps/web/app/api/v1/orders/[orderId]/fulfillment/route");
const ordCancel=await import("../../apps/web/app/api/v1/orders/[orderId]/cancellation/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","order:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birth(40),sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function order(t:string,p:string,orderType:string,detail:string){const id=crypto.randomUUID();const r=await ordR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({orderId:id,patientId:p,orderType,detail,occurredAt:at()})}));return{id,status:r.status};}
async function place(t:string,id:string){return ordPlace.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({orderId:id})});}
async function fulfill(t:string,id:string){return ordFul.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({orderId:id})});}
async function cancel(t:string,id:string){return ordCancel.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"Cancelada por el médico",occurredAt:at()})}),{params:Promise.resolve({orderId:id})});}
async function list(t:string){const r=await ordR.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();const p1=crypto.randomUUID(),p2=crypto.randomUUID();
 await reg(phys,p1,"Ana López García");await reg(phys,p2,"Carlos Mendoza");
 const o1=await order(phys,p1,"LAB","Biometría hemática completa");   // -> completada
 const o2=await order(phys,p2,"IMAGING","Radiografía de tórax");       // -> enviada
 await order(phys,p1,"LAB","Química sanguínea");                        // solicitada
 const o4=await order(phys,p2,"REFERRAL","Cardiología");               // -> cancelada
 ok(o1.status===201&&o2.status===201,"CREATE_201");
 const pl1=await place(phys,o1.id);ok(pl1.status===200||pl1.status===201,"PLACE_OK");
 const fu1=await fulfill(phys,o1.id);ok(fu1.status===200||fu1.status===201,"FULFILL_OK");
 await place(phys,o2.id);
 const cn=await cancel(phys,o4.id);ok(cn.status===200||cn.status===201,"CANCEL_OK");

 const L=await list(phys);ok(L.status===200,"LIST_200");
 const b=L.body as{total:number;solicitadas:number;enviadas:number;completadas:number;items:{detail:string;typeLabel:string;status:string;patientName:string;version:number}[]};
 ok(b.total===4,"TOTAL_4");
 const byD=(d:string)=>b.items.find(i=>i.detail===d);
 ok(byD("Biometría hemática completa")?.status==="Completada","STATUS_COMPLETADA");
 ok(byD("Radiografía de tórax")?.status==="Enviada"&&byD("Radiografía de tórax")?.typeLabel==="Imagenología","STATUS_ENVIADA_IMG");
 ok(byD("Química sanguínea")?.status==="Solicitada","STATUS_SOLICITADA");
 ok(byD("Cardiología")?.status==="Cancelada"&&byD("Cardiología")?.typeLabel==="Interconsulta","STATUS_CANCELADA_REF");
 ok(byD("Biometría hemática completa")?.patientName==="Ana López García","PATIENT_JOIN");
 // versión = nº de eventos: solicitada=1, enviada=2 (created+placed), completada=3 (created+placed+fulfilled)
 ok(byD("Química sanguínea")?.version===1,"VERSION_SOLICITADA_1");
 ok(byD("Radiografía de tórax")?.version===2,"VERSION_ENVIADA_2");
 ok(byD("Biometría hemática completa")?.version===3,"VERSION_COMPLETADA_3");
 ok(b.solicitadas===1&&b.enviadas===1&&b.completadas===1,"COUNTS");

 const noScope=await list(tok(["patient:read"]));ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
