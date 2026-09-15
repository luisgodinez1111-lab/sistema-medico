// EPIC C — Benchmark de performance del vertical clínico wired, contra Neon en vivo.
// Ejecuta: pnpm exec tsx ./scripts/v22/perf-benchmark.mts
// Mide latencias (p50/p95/p99) de escritura y lectura + throughput bajo concurrencia, y las
// evalúa contra un presupuesto con el gate real `performanceGate`. Escribe filas de prueba
// aditivas (tenants aleatorios) en el Neon actual.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{
 const envRaw=fs.readFileSync(path.resolve(".env.local"),"utf8");
 for(const line of envRaw.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(line.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}
}catch{/* env ya cargado */}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"epic-c-perf-secret";
const SECRET=process.env.SESSION_SIGNING_SECRET;

const{signSession}=await import("../../packages/session/src");
const{POST,GET}=await import("../../apps/web/app/api/v1/encounters/route");
const{performanceGate}=await import("../../packages/performance-gate/src");

const TENANT=crypto.randomUUID();
const now=Math.floor(Date.now()/1000);
const tok=signSession({sub:crypto.randomUUID(),tenantId:TENANT,roles:["PHYSICIAN"],scopes:["encounter:write","encounter:read"],purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);

function openReq(){
 const encounterId=crypto.randomUUID();
 const req=new Request("http://local/api/v1/encounters",{method:"POST",headers:{authorization:"Bearer "+tok,"idempotency-key":crypto.randomUUID(),"content-type":"application/json"},body:JSON.stringify({encounterId,patientId:crypto.randomUUID(),occurredAt:new Date().toISOString()})});
 return{encounterId,req};
}
function readReq(encounterId:string){return new Request("http://local/api/v1/encounters?encounterId="+encounterId,{headers:{authorization:"Bearer "+tok}});}
function pct(sorted:number[],p:number){if(!sorted.length)return 0;const i=Math.min(sorted.length-1,Math.ceil(p/100*sorted.length)-1);return Math.round(sorted[i]!);}

const WRITE_N=60,READ_N=60,BURST_N=40,CONCURRENCY=10;
let errors=0;
const created:string[]=[];
const writeMs:number[]=[];
// Warmup (excluido de métricas): primera conexión + role startup.
{const{req}=openReq();const r=await POST(req);if(r.status!==201)errors++;else created.push("warmup");}

// Fase escritura (serial): latencias de POST open encounter.
for(let i=0;i<WRITE_N;i++){const{encounterId,req}=openReq();const t=performance.now();const r=await POST(req);const dt=performance.now()-t;if(r.status===201){writeMs.push(dt);created.push(encounterId);}else errors++;}

// Fase lectura (serial): latencias de GET RLS-scoped sobre los encuentros creados.
const readMs:number[]=[];
for(let i=0;i<READ_N&&i<created.length;i++){const id=created[i+1]!;if(!id)continue;const t=performance.now();const r=await GET(readReq(id));const dt=performance.now()-t;if(r.status===200)readMs.push(dt);else errors++;}

// Fase throughput: ráfagas concurrentes de POST.
const burstStart=performance.now();
let burstOk=0;
for(let done=0;done<BURST_N;done+=CONCURRENCY){
 const batch=Array.from({length:Math.min(CONCURRENCY,BURST_N-done)},()=>POST(openReq().req));
 const rs=await Promise.all(batch);
 for(const r of rs){if(r.status===201)burstOk++;else errors++;}
}
const burstSec=(performance.now()-burstStart)/1000;
const throughput=Math.round((burstOk/burstSec)*10)/10;

const ws=[...writeMs].sort((a,b)=>a-b);
const totalReq=WRITE_N+READ_N+BURST_N+1;
const perf={p50:pct(ws,50),p95:pct(ws,95),p99:pct(ws,99),errorRate:Math.round((errors/totalReq)*1e4)/1e4,throughput};
// Gate de SALUD (lo que sí depende del código): latencia + tasa de error. Camino local->Neon
// remoto con ~8 round-trips secuenciales por comando atómico (secuenciales por correctness).
// throughputMin=0 A PROPÓSITO: el throughput de un único proceso local contra un Neon remoto
// NO es una capacidad de producción (lo limita el RTT/tier, no el código). Se REPORTA como
// baseline observado, no se usa como pass/fail. Ver docs/reviews/...epic-c...
const budget={p95Max:2000,p99Max:4000,errorRateMax:0.02,throughputMin:0};
const gate=performanceGate(perf,budget);
const out={status:gate.pass?"PASS":"FAIL",perf,read:{p50:pct(readMs.slice().sort((a,b)=>a-b),50),p95:pct(readMs.slice().sort((a,b)=>a-b),95)},budget,failures:gate.failures,throughput_note:"observado (single-client local->Neon remoto); no gateado como capacidad",samples:{writes:writeMs.length,reads:readMs.length,burst:burstOk,errors}};
console.log(JSON.stringify(out,null,2));
process.exit(gate.pass?0:1);
