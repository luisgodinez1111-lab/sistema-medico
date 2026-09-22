// EPIC AC/UI — Evidencia física: obligaciones regulatorias del consultorio (vista Obligaciones). Crea obligaciones
// con fechas límite variadas y verifica GET -> estado COMPUTADO (Al día/Próxima/Vencida/Vigente) + KPIs +
// cumplimiento por categoría. Aggregate nuevo RegulatoryObligation sobre el kernel event-sourced. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-ac-reg-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const roR=await import("../../apps/web/app/api/v1/regulatory-obligations/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["obligation:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();
const iso=(daysFromNow:number)=>new Date(Date.now()+daysFromNow*86400000).toISOString();
async function create(t:string,name:string,category:string,periodicity:string,dueDate:string|null){const id=crypto.randomUUID();const r=await roR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({obligationId:id,name,category,periodicity,...(dueDate?{dueDate}:{}),occurredAt:new Date().toISOString()})}));return{id,status:r.status};}
async function list(t:string){const r=await roR.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();
 const c1=await create(phys,"Declaración mensual de IVA","Fiscal (SAT)","Mensual",iso(2));    // Próxima (<=30)
 await create(phys,"Renovación de aviso de funcionamiento","Salud (COFEPRIS)","Cada 5 años",iso(400)); // Al día
 await create(phys,"Pago de IMSS","Laboral","Mensual",iso(-3));                                  // Vencida
 await create(phys,"Aviso de funcionamiento COFEPRIS","Salud (COFEPRIS)","Única",null);          // Vigente (sin fecha)
 await create(phys,"Extintores (mantenimiento)","Protección civil","Semestral",iso(15));         // Próxima
 ok(c1.status===201,"CREATE_201");

 const L=await list(phys);ok(L.status===200,"LIST_200");
 const b=L.body as{total:number;alDia:number;proximas:number;vencidas:number;compliance:Record<string,number>;items:{name:string;estado:string;category:string}[]};
 ok(b.total===5,"TOTAL_5");
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

 // sin scope -> 403
 const noScope=await list(tok(["patient:read"]));
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
