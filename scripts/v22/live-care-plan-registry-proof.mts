// EPIC E/UI (Lote E) — Evidencia física: registro POBLACIONAL de planes de cuidado (vista Plan de cuidado › «Toda la
// clínica»). Propone planes para varios pacientes, los transiciona (activar / pausar / lograr) y consulta
// GET /api/v1/care-plans -> filas clínica-wide con ESTADO por última transición + conteos coherentes
// (activos/en pausa/logrados/pacientes) calculados en la base. RLS-scoped. vs Postgres local.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const cpR=await import("../../apps/web/app/api/v1/care-plans/route");
const actR=await import("../../apps/web/app/api/v1/care-plans/[carePlanId]/activation/route");
const holdR=await import("../../apps/web/app/api/v1/care-plans/[carePlanId]/hold/route");
const achR=await import("../../apps/web/app/api/v1/care-plans/[carePlanId]/achievement/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","careplan:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();const at=new Date().toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birth(50),sexAtBirth:"MALE",occurredAt:at})}));}
async function propose(t:string,p:string,category:string,goal:string){const id=crypto.randomUUID();const r=await cpR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({carePlanId:id,patientId:p,category,goal,occurredAt:at})}));return{id,version:Number((await r.json()).version??1)};}
function trans(mod:{POST:(r:Request,c:{params:Promise<{carePlanId:string}>})=>Promise<Response>},t:string,id:string,ver:number,body:Record<string,unknown>={}){return mod.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(ver)}),body:JSON.stringify({occurredAt:at,...body})}),{params:Promise.resolve({carePlanId:id})});}
async function registry(t:string){const r=await cpR.GET(new Request("http://l/api/v1/care-plans",{headers:H(t)}));return{status:r.status,body:await r.json()};}
type Row={carePlanId:string;patientId:string;category:string;goal:string;status:string};
const{result,ok,fin}=libro();
try{
 const phys=tok();
 const p1=crypto.randomUUID();await reg(phys,p1,`Ana Plan ${p1.slice(0,8)}`);
 const p2=crypto.randomUUID();await reg(phys,p2,`Beto Plan ${p2.slice(0,8)}`);
 // p1: un plan ACTIVADO y otro LOGRADO (activar -> lograr).
 const a=await propose(phys,p1,"DIABETES","HbA1c < 7% en 3 meses");
 ok((await trans(actR,phys,a.id,a.version)).status<400,"P1_ACTIVATED");
 const b=await propose(phys,p1,"OBESITY","Bajar 5 kg");
 const bAct=await trans(actR,phys,b.id,b.version);ok(bAct.status<400,"P1B_ACTIVATED");
 ok((await trans(achR,phys,b.id,Number((await bAct.json()).version??2))).status<400,"P1B_ACHIEVED");
 // p2: un plan EN PAUSA (activar -> pausar) y otro que queda PROPUESTO.
 const c=await propose(phys,p2,"HYPERTENSION","TA < 130/80");
 const cAct=await trans(actR,phys,c.id,c.version);ok(cAct.status<400,"P2_ACTIVATED");
 ok((await trans(holdR,phys,c.id,Number((await cAct.json()).version??2))).status<400,"P2_HELD");
 await propose(phys,p2,"MENTAL_HEALTH","Adherencia a terapia");

 const g=await registry(phys);ok(g.status===200,"REGISTRY_200");
 const items=g.body.items as Row[];
 ok(g.body.total===4,"TOTAL_4");
 ok(items.length===4,"ITEMS_LEN");
 // 4 planes: a(activo) + b(logrado) para p1; c(en pausa) + mental-health(propuesto) para p2.
 // estado por ÚLTIMA transición: 1 activo (a), 1 logrado (b), 1 en pausa (c), 1 propuesto → activos=1.
 ok(g.body.activeCount===1,"ACTIVE_COUNT");
 ok(g.body.onHoldCount===1,"ONHOLD_COUNT");
 ok(g.body.achievedCount===1,"ACHIEVED_COUNT");
 ok(g.body.patientsCount===2,"PATIENTS_DISTINCT");
 // los conteos del resumen son COHERENTES con las filas.
 ok(items.filter(r=>r.status==="ACTIVE").length===g.body.activeCount,"ACTIVE_COHERENT");
 ok(items.filter(r=>r.status==="ON_HOLD").length===g.body.onHoldCount,"ONHOLD_COHERENT");
 ok(items.filter(r=>r.status==="ACHIEVED").length===g.body.achievedCount,"ACHIEVED_COHERENT");
 // la categoría y el objetivo viajan tal cual.
 const one=items.find(r=>r.carePlanId===a.id)!;ok(one.category==="DIABETES"&&one.goal==="HbA1c < 7% en 3 meses"&&one.status==="ACTIVE","CATEGORY_GOAL_STATUS");
 // sin scope de plan de cuidado -> 403.
 const noScope=await registry(tok(["patient:write"]));ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
