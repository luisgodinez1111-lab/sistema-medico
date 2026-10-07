// EPIC Y/UI — Evidencia física: registro de facturación de toda la clínica (vista Facturación). Crea facturas
// (Claim) de varios pacientes, transiciona algunas a PAID (draft->code->submit->pay) y una a VOID, y consulta
// GET /claims -> folio + estado + join paciente + KPIs (ingresos/emitidas/pendientes/cancelaciones). vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const clR=await import("../../apps/web/app/api/v1/claims/route");
const clCode=await import("../../apps/web/app/api/v1/claims/[claimId]/coding/route");
const clSub=await import("../../apps/web/app/api/v1/claims/[claimId]/submission/route");
const clPay=await import("../../apps/web/app/api/v1/claims/[claimId]/payment/route");
const clVoid=await import("../../apps/web/app/api/v1/claims/[claimId]/void/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","billing:write"],tenantId=TA){return signSession({sub:crypto.randomUUID(),tenantId,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birth(40),sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function draft(t:string,p:string,amount:string){const id=crypto.randomUUID();const r=await clR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({claimId:id,patientId:p,amount,currency:"MXN",occurredAt:at()})}));return{id,status:r.status};}
async function code(t:string,id:string){return clCode.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({codes:["E11.9"],occurredAt:at()})}),{params:Promise.resolve({claimId:id})});}
async function submit(t:string,id:string){return clSub.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({claimId:id})});}
async function pay(t:string,id:string){return clPay.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({reference:"PAY-"+id.slice(0,8),occurredAt:at()})}),{params:Promise.resolve({claimId:id})});}
async function paid(t:string,id:string){await code(t,id);await submit(t,id);return pay(t,id);}
async function voidC(t:string,id:string){return clVoid.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"Duplicada",occurredAt:at()})}),{params:Promise.resolve({claimId:id})});}
async function list(t:string,month?:string){const r=await clR.GET(new Request(`http://l/${month?`?month=${month}`:""}`,{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
const{result,ok,fin}=libro();
try{
 const phys=tok();const p1=crypto.randomUUID(),p2=crypto.randomUUID();
 await reg(phys,p1,"Ana López García");await reg(phys,p2,"Mateo Ramírez");
 const c1=await draft(phys,p1,"500");   // pagada
 const c2=await draft(phys,p2,"1200");  // pagada
 const c3=await draft(phys,p1,"350");   // pendiente
 const c4=await draft(phys,p2,"800");   // cancelada
 ok(c1.status===201&&c4.status===201,"DRAFT_201");
 const pr1=await paid(phys,c1.id);ok(pr1.status===200||pr1.status===201,"PAY1_OK");
 await paid(phys,c2.id);
 const vr=await voidC(phys,c4.id);ok(vr.status===200||vr.status===201,"VOID_OK");

 // Auditoría L-09: una factura pagada en AGOSTO no cuenta en los ingresos de septiembre (antes se sumaba toda la historia).
 const c5=await draft(phys,p1,"999");await code(phys,c5.id);await submit(phys,c5.id);
 const pAug=await clPay.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({reference:"PAY-AGO",occurredAt:"2026-08-15T16:00:00.000Z"})}),{params:Promise.resolve({claimId:c5.id})});
 ok(pAug.status===200||pAug.status===201,"PAY_AUGUST_OK");

 const L=await list(phys,"2026-09");ok(L.status===200,"LIST_200");
 const b=L.body as{total:number;incomePeriod:string;incomeThisMonth:number;incomeAllTime:number;issuedCount:number;pendingCount:number;pendingAmount:number;cancellations:number;items:{folio:string;patientName:string;amount:number;statusLabel:string;status:string}[]};
 ok(b.total===5,"TOTAL_5");
 ok(b.issuedCount===5,"ISSUED_5");
 // 2 pagadas en septiembre (500+1200=1700); la de agosto (999) solo en el histórico y en su propio mes
 ok(b.incomePeriod==="2026-09"&&b.incomeThisMonth===1700,"INCOME_SEPTEMBER_1700_EXCLUDES_AUGUST");
 ok(b.incomeAllTime===2699,"INCOME_ALL_TIME_2699");
 ok(((await list(phys,"2026-08")).body as{incomeThisMonth:number}).incomeThisMonth===999,"INCOME_AUGUST_999");
 // 1 pendiente (350)
 ok(b.pendingCount===1&&b.pendingAmount===350,"PENDING_1_350");
 // 1 cancelada
 ok(b.cancellations===1,"CANCELLATIONS_1");
 // folios secuenciales: la más reciente F-000004
 ok(b.items[0]!.folio==="F-000005","FOLIO_SEQUENTIAL");
 // join del nombre + etiqueta ES
 ok(b.items.some(i=>i.patientName==="Ana López García"),"PATIENT_JOIN");
 ok(b.items.some(i=>i.statusLabel==="Pagada")&&b.items.some(i=>i.statusLabel==="Cancelada"),"LABELS_ES");

 // Auditoría R02b (R2B-021, lote 18): EL SIGNO Y LA FORMA DEL IMPORTE.
 //
 // El parseo del tablero hacía `replace(/[^0-9.]/g,"")`, que borra el menos: una nota de crédito de «-500.00» se leía como
 // 500 POSITIVOS e inflaba los ingresos. Y `amount` era `z.string().min(1)`, así que «asdf» entraba al registro y luego el
 // `::numeric` de la consulta de indicadores LANZABA: una sola fila mala tumbaba el tablero de facturación completo.
 {
  const tNuevo=crypto.randomUUID();
  const w=tok(["billing:write","billing:read","patient:write","patient:read"],tNuevo);
  const p=crypto.randomUUID();
  await reg(w,p,"Nota de Crédito Prueba");
  // Un importe sin forma de número se rechaza EN LA PUERTA, no se descubre al sumar.
  const basura=await draft(w,p,"asdf");
  ok(basura.status===400,"NON_NUMERIC_AMOUNT_REJECTED:"+basura.status);
  ok((await draft(w,p,"1.234")).status===400,"THREE_DECIMALS_REJECTED");
  // Una nota de crédito (importe negativo) SÍ se admite: es un movimiento legítimo.
  const nota=await draft(w,p,"-500.00");
  ok(nota.status===201,"CREDIT_NOTE_ACCEPTED:"+nota.status);
  // Y el tablero la lee con su signo, en vez de como 500 positivos.
  const registro=await list(w);
  const bb=registro.body as{items:{claimId:string;amount:number}[]};
  const fila=bb.items.find(i=>i.claimId===nota.id);
  ok(fila!==undefined&&fila.amount===-500,"CREDIT_NOTE_KEEPS_SIGN:"+String(fila?.amount));
 }

 // sin scope -> 403
 const noScope=await list(tok(["patient:read"]));
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
