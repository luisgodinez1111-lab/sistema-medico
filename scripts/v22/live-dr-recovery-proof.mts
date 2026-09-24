// EPIC BH (ENG-055 Backup/DR) — Evidencia física de RECUPERABILIDAD contra DATABASE_URL (contenedor de CI o
// Neon). Verifica las invariantes que hacen segura una restauración/replay:
//  - Replay determinista: el stream persistido == el hash puro esperado (obligationsMatch).
//  - Cadena de auditoría encadenada (integridad tras recuperar).
//  - Reconciliación de recuperación (ENG-055-R005): re-aplicar el MISMO comando NO duplica eventos (idempotente).
//  - RLS aísla por tenant.
// A diferencia de restore-drill.mts (source vs target), corre contra un solo DB con un tenant aleatorio -> apto para CI.
import crypto from"node:crypto";
import{directEndpoint as direct}from"../../packages/pg-endpoint/src";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
import{deterministicUuid}from"../../packages/canonical-json/src";
const RUNTIME_ROLE="medical_os_runtime";
const{default:postgres}=await import("postgres");
const{executeAtomicClinicalCommand}=await import("../../packages/atomic-clinical-transaction-v3/src");
const{canonicalize}=await import("../../packages/canonical-json/src");
const{restoreErrors}=await import("../../packages/restore-proof/src");
const result:{status:string;checks:string[];proof?:unknown;error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const det=(seed:string):string=>deterministicUuid(seed); // R01-015: única derivación de UUID del repo
// tenant aleatorio (seguro en DB compartida); aggregate = el tenant, versiones incrementales.
const RUN=crypto.randomUUID();const TENANT=det("dr-tenant-"+RUN);const AGG=det("dr-agg-"+RUN);
function seededCommand(i:number){const key=`dr-cmd-${RUN}-${i}`;return{commandId:det(key+":command"),idempotencyKey:key,aggregateId:AGG,aggregateType:"Encounter",expectedVersion:i,eventId:det(key+":event"),eventType:"ENCOUNTER_OPENED",payload:{step:i},outboxId:det(key+":outbox"),topic:"encounter.opened",auditId:det(key+":audit"),correlationId:det(key+":corr"),occurredAt:"2026-01-01T00:00:00.000Z"};}
const rt=postgres(direct(process.env.DATABASE_URL!),{max:4,prepare:false,onnotice:()=>{},connection:{options:`-c role=${RUNTIME_ROLE}`}});
try{
 const ctx={tenantId:TENANT,actorId:det("dr-actor"),actorType:"SYSTEM" as const,purpose:"TREATMENT",requestId:det("dr-req")}; // prueba de DR: comandos del SISTEMA, no de un humano (auditoría S-06)
 // 1) Stream determinista de 2 comandos.
 for(let i=0;i<2;i++)await executeAtomicClinicalCommand(rt,ctx,seededCommand(i) as never);
 const countEvents=async()=>{const r=await rt.begin(async tx=>{await tx`select set_config('app.tenant_id',${ctx.tenantId},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;return tx`select count(*)::int n from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${AGG}`;});return Number(r[0]!.n);};
 ok(await countEvents()===2,"STREAM_PERSISTED_2");
 // 2) Replay determinista: hash del stream persistido == hash puro esperado.
 const ev=await rt.begin(async tx=>{await tx`select set_config('app.tenant_id',${ctx.tenantId},true)`;return tx`select aggregate_id,sequence,payload from clinical_events where tenant_id=${ctx.tenantId} and aggregate_id=${AGG} order by sequence`;});
 const replayHash=crypto.createHash("sha256").update(canonicalize(ev.map(e=>({a:e.aggregate_id,s:Number(e.sequence),p:e.payload})))).digest("hex");
 const liveHash=crypto.createHash("sha256").update(canonicalize([0,1].map(i=>({a:AGG,s:i+1,p:{step:i}})))).digest("hex");
 ok(replayHash===liveHash,"DETERMINISTIC_REPLAY_MATCH");
 // 3) Reconciliación (R005): re-aplicar el MISMO comando NO duplica eventos.
 try{await executeAtomicClinicalCommand(rt,ctx,seededCommand(0) as never);}catch{/* rechazo por duplicado también es válido */}
 try{await executeAtomicClinicalCommand(rt,ctx,seededCommand(1) as never);}catch{/* idem */}
 ok(await countEvents()===2,"IDEMPOTENT_NO_DUPLICATION");
 // 4) Cadena de auditoría encadenada.
 const chain=await rt.begin(async tx=>{await tx`select set_config('app.tenant_id',${ctx.tenantId},true)`;return tx`select sequence,previous_hash,entry_hash from audit_chain_v3 where tenant_id=${ctx.tenantId} order by sequence`;});
 ok(chain.length>=2&&chain[1]!.previous_hash===chain[0]!.entry_hash,"AUDIT_CHAIN_CHAINED");
 // 5) RLS: otro tenant no ve estos eventos.
 const leak=await rt.begin(async tx=>{await tx`select set_config('app.tenant_id',${det("dr-other-"+RUN)},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose',${ctx.purpose},true),set_config('app.request_id',${ctx.requestId},true)`;return tx`select count(*)::int n from clinical_events where aggregate_id=${AGG}`;});
 ok(Number(leak[0]!.n)===0,"RLS_ISOLATION");
 // Resumen vía restore-proof (schema trivialmente igual: mismo DB).
 const proof={schemaHash:"single",expectedSchemaHash:"single",auditValid:chain.length>=2&&chain[1]!.previous_hash===chain[0]!.entry_hash,rlsPass:Number(leak[0]!.n)===0,replayHash,liveHash,obligationsMatch:replayHash===liveHash};
 const errs=restoreErrors(proof);result.proof={errors:errs};ok(errs.length===0,"RESTORE_PROOF_CLEAN");
}catch(e){result.status="FAIL";result.error=String(e);}
finally{await rt.end();}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
