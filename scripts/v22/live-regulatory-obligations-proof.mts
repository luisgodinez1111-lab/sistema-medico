// EPIC AC/UI — Evidencia física: obligaciones regulatorias del consultorio (vista Obligaciones). Crea obligaciones
// con fechas límite variadas y verifica GET -> estado COMPUTADO (Al día/Próxima/Vencida/Vigente) + KPIs +
// cumplimiento por categoría. Aggregate nuevo RegulatoryObligation sobre el kernel event-sourced. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const roR=await import("../../apps/web/app/api/v1/regulatory-obligations/route");
const roComply=await import("../../apps/web/app/api/v1/regulatory-obligations/[obligationId]/compliance/route");
const roRenew=await import("../../apps/web/app/api/v1/regulatory-obligations/[obligationId]/renewal/route");
const PP=(id:string)=>({params:Promise.resolve({obligationId:id})});
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["obligation:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();
// R2B-024 (lote 20): la fecha límite pasa a ser YYYY-MM-DD —una obligación vence un DÍA, no un instante— y la periodicidad
// deja de ser texto libre para poder derivar el próximo vencimiento.
const iso=(daysFromNow:number)=>new Date(Date.now()+daysFromNow*86400000).toISOString().slice(0,10);
async function create(t:string,name:string,category:string,periodicity:string,dueDate:string|null){const id=crypto.randomUUID();const r=await roR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:id,name,category,periodicity,...(dueDate?{dueDate}:{}),occurredAt:new Date().toISOString()})}));return{id,status:r.status};}
async function list(t:string){const r=await roR.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();
 const c1=await create(phys,"Declaración mensual de IVA","Fiscal (SAT)","MENSUAL",iso(2));    // Próxima (<=30)
 await create(phys,"Renovación de aviso de funcionamiento","Salud (COFEPRIS)","OTRA",iso(400)); // Al día
 await create(phys,"Pago de IMSS","Laboral","MENSUAL",iso(-3));                                  // Vencida
 await create(phys,"Aviso de funcionamiento COFEPRIS","Salud (COFEPRIS)","UNICA",null);          // Vigente (sin fecha)
 await create(phys,"Extintores (mantenimiento)","Protección civil","SEMESTRAL",iso(15));         // Próxima
 ok(c1.status===201,"CREATE_201");

 const L=await list(phys);ok(L.status===200,"LIST_200");
 const b=L.body as{total:number;alDia:number;proximas:number;vencidas:number;compliance:Record<string,number>;items:{name:string;estado:string;category:string}[]};
 ok(b.total===5,"TOTAL_5"); // el bloque de cumplimiento crea las suyas después de esta comprobación
 const byName=(n:string)=>b.items.find(i=>i.name===n);
 // estado computado de la fecha límite
 ok(byName("Declaración mensual de IVA")?.estado==="Próxima","STATUS_PROXIMA");
 ok(byName("Renovación de aviso de funcionamiento")?.estado==="Al día","STATUS_AL_DIA");
 ok(byName("Pago de IMSS")?.estado==="Vencida","STATUS_VENCIDA");
 ok(byName("Aviso de funcionamiento COFEPRIS")?.estado==="Vigente","STATUS_VIGENTE");
 // KPIs: al día incluye Vigente (2), próximas (2), vencidas (1)
 ok(b.alDia===2&&b.proximas===2&&b.vencidas===1,"KPIS");
 // cumplimiento por categoría: Laboral 0% (1 vencida), Fiscal 100% (1 próxima no vencida)
 ok(b.compliance["Laboral"]===0,"COMPLIANCE_LABORAL_0");
 ok(b.compliance["Fiscal (SAT)"]===100,"COMPLIANCE_FISCAL_100");

 // Auditoría R02b (R2B-024, lote 20): EL CICLO QUE NO EXISTÍA.
 //
 // El archivo tenía UN handler —crear— así que una obligación registrada no se podía marcar cumplida, ni adjuntar evidencia,
 // ni renovar: un registro en el que nada se cumple solo crece. Ahora cumplir exige EVIDENCIA y renovar DERIVA el próximo
 // vencimiento de la periodicidad declarada, que es para lo que dejó de ser texto libre.
 {
  const B=(v:number,body:Record<string,unknown>)=>({method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:new Date().toISOString(),...body})});
  const anual=await create(phys,"Revisión anual del aviso de privacidad","Administrativa","ANUAL","2026-01-31");
  ok(anual.status===201,"CREATE_ANNUAL_201");
  // Cumplir SIN evidencia se rechaza: «cumplida» sin nada que lo respalde es una opinión.
  let r=await roComply.POST(new Request("http://l/",B(1,{})),PP(anual.id));
  ok(r.status===400,"COMPLY_WITHOUT_EVIDENCE_REJECTED:"+r.status);
  r=await roComply.POST(new Request("http://l/",B(1,{evidenceRef:"ACUSE-2026-0091",notes:"Publicado en recepción y en el portal"})),PP(anual.id));
  ok(r.status===201,"COMPLY_201:"+r.status);
  // Cumplir DOS VECES es un error de secuencia, no una escritura más.
  r=await roComply.POST(new Request("http://l/",B(2,{evidenceRef:"ACUSE-2026-0092"})),PP(anual.id));
  ok(r.status===409,"DOUBLE_COMPLY_409:"+r.status);
  // Renovar DERIVA el próximo vencimiento de la periodicidad: 2026-01-31 + 1 año.
  r=await roRenew.POST(new Request("http://l/",B(2,{})),PP(anual.id));
  const j=await r.json() as{state:string;dueDate:string;derivedFromPeriodicity:boolean};
  ok(r.status===201&&j.state==="OPEN","RENEW_201:"+r.status);
  ok(j.dueDate==="2027-01-31"&&j.derivedFromPeriodicity===true,"RENEWAL_DERIVES_NEXT_DUE_DATE:"+j.dueDate);
  // Y la obligación vuelve a estar abierta con su nueva fecha, visible en el registro.
  const L2=await list(phys);
  const fila=(L2.body as{items:{name:string;dueDate:string|null}[]}).items.find(i=>i.name==="Revisión anual del aviso de privacidad");
  ok(fila?.dueDate==="2027-01-31","RENEWED_DUE_DATE_IN_REGISTRY:"+String(fila?.dueDate));
  // Una obligación SIN periodicidad que derive nada exige declarar la fecha: no se inventa.
  const suelta=await create(phys,"Trámite único","Otros","UNICA","2026-03-15");
  await roComply.POST(new Request("http://l/",B(1,{evidenceRef:"FOLIO-1"})),PP(suelta.id));
  r=await roRenew.POST(new Request("http://l/",B(2,{})),PP(suelta.id));
  ok(r.status===400,"RENEW_WITHOUT_DERIVABLE_PERIOD_REJECTED:"+r.status);
  r=await roRenew.POST(new Request("http://l/",B(2,{dueDate:"2027-03-15"})),PP(suelta.id));
  ok(r.status===201,"RENEW_WITH_EXPLICIT_DATE_201:"+r.status);
  // Renovar algo que NO se ha cumplido es un conflicto de secuencia.
  const abierta=await create(phys,"Otra obligación","Otros","ANUAL","2026-06-01");
  r=await roRenew.POST(new Request("http://l/",B(1,{})),PP(abierta.id));
  ok(r.status===409,"RENEW_BEFORE_COMPLY_409:"+r.status);
  // Una obligación inexistente es 404, no un estado inicial silencioso.
  r=await roComply.POST(new Request("http://l/",B(1,{evidenceRef:"X-1"})),PP(crypto.randomUUID()));
  ok(r.status===404,"UNKNOWN_OBLIGATION_404:"+r.status);
 }

 // sin scope -> 403
 const noScope=await list(tok(["patient:read"]));
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
