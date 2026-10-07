// Auditoría 2026-09-19, anexo R07 (R07-05) — LAS TRES RUTAS QUE FALTABAN.
//
// El hallazgo decía «0 de 151 route.ts tienen un test propio; sin infraestructura para probar HTTP». Al medirlo hoy eran
// 159 de 162 las que sí se ejercitan con su handler real contra una base real. Las tres que faltaban son éstas, y no son
// triviales por igual: `/api/v1/features` decide QUÉ PINTA la interfaz —si devolviera las banderas a un anónimo, filtraría
// la configuración del consultorio— y la cancelación de una sesión de diálisis es una transición terminal de una vertical.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{ensurePatientIn}=await import("./_patient.mts");
const feat=await import("../../apps/web/app/api/v1/features/route");
const health=await import("../../apps/web/app/api/health/route");
const ready=await import("../../apps/web/app/api/health/ready/route");
const dz=await import("../../apps/web/app/api/v1/dialysis-sessions/route");
const dzCancel=await import("../../apps/web/app/api/v1/dialysis-sessions/[dialysisId]/cancellation/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const tok=(scopes:string[]=["dialysis:write"])=>signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
const H=(t?:string,x:Record<string,string>={})=>{const h:Record<string,string>={"content-type":"application/json",...x};if(t)h["authorization"]="Bearer "+t;return h;};
const idem=()=>crypto.randomUUID();const ISO="2026-04-04T08:00:00.000Z";
const{result,ok,fin}=libro();
try{
 // === /api/health — sonda de vida: sin sesión y sin PHI ===
 const h=await health.GET();const hb=await h.json() as {status?:string;service?:string};
 ok(h.status===200&&hb.status==="ALIVE","HEALTH_ALIVE_200");
 ok(!JSON.stringify(hb).match(/patient|curp|nombre/i),"HEALTH_NO_PHI");

 // === /api/health/ready — readiness profundo: con la base DESECHABLE arriba, READY 200, dependencia UP y sin PHI ===
 const rd=await ready.GET();const rdb=await rd.json() as {status?:string;dependencies?:{name:string;status:string}[]};
 ok(rd.status===200&&rdb.status==="READY","READY_200_WITH_DB");
 ok(Array.isArray(rdb.dependencies)&&rdb.dependencies.some(d=>d.name==="database"&&d.status==="UP"),"READY_DB_UP");
 ok(!JSON.stringify(rdb).match(/patient|curp|nombre/i),"READY_NO_PHI");

 // === /api/v1/features — exige sesión: la configuración del consultorio no se revela a un anónimo ===
 let r:Response=await feat.GET(new Request("http://l/",{headers:H()}));
 ok(r.status===401,"FEATURES_ANONYMOUS_401");
 r=await feat.GET(new Request("http://l/",{headers:H(tok(["patient:read"]))}));
 const fb=await r.json() as Record<string,unknown>;
 ok(r.status===200&&typeof fb["hospitalVerticals"]==="boolean","FEATURES_WITH_SESSION_200");
 ok(r.headers.get("cache-control")==="no-store","FEATURES_NO_STORE"); // una bandera cacheada deja la UI mintiendo tras un cambio

 // === cancelación de una sesión de diálisis: transición terminal con motivo ===
 const phys=tok();const pat=crypto.randomUUID();await ensurePatientIn(TA,pat);
 const id=crypto.randomUUID();
 r=await dz.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({dialysisId:id,patientId:pat,modality:"HEMODIALYSIS",accessType:"CATHETER",prescribedMinutes:240,occurredAt:ISO})}));
 ok(r.status===201,"DIALYSIS_SCHEDULED_201");
 const DP=(x:string)=>({params:Promise.resolve({dialysisId:x})});
 r=await dzCancel.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"Paciente hospitalizado por otra causa",occurredAt:ISO})}),DP(id));
 ok(r.status===201&&(await r.json()).state==="CANCELLED","DIALYSIS_CANCELLED_201");
 // Sin motivo NO se cancela: la misma disciplina que el resto del registro (U-16).
 r=await dzCancel.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO})}),DP(crypto.randomUUID()));
 ok(r.status>=400,"DIALYSIS_CANCEL_WITHOUT_REASON_REJECTED");
}catch(e){fin(e);}
fin();
