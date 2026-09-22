// Auditoría 2026-09-19 (S-07) — PRUEBA EN VIVO del verificador de la cadena de auditoría contra PostgreSQL real.
// Demuestra lo único que importa: que la huella recalculada por el verificador coincide con la que escribió
// `app.append_audit_v17` para CADA entrada, y que el enlace de la cadena es correcto. Antes el verificador usaba otra
// fórmula y jamás habría verificado una cadena real. Además comprueba, con el rol de la aplicación, que la cadena es
// append-only (no se puede alterar ni borrar una entrada) y que la verificación respeta el aislamiento por tenant.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{/* sin .env.local: se usa el entorno */}
if(!process.env.DATABASE_URL){console.log(JSON.stringify({status:"NOT_RUN",reason:"DATABASE_URL_MISSING"}));process.exit(3);}
const direct=(u:string)=>u.replace("-pooler","").replace(/([?&])channel_binding=require/,"$1").replace(/[?&]$/,"");
const RUNTIME_ROLE="medical_os_runtime";
const{default:postgres}=await import("postgres");
const{executeAtomicClinicalCommand}=await import("../../packages/atomic-clinical-transaction-v3/src");
const{verifyTenantAuditChain,verifyChain,AUDIT_GENESIS}=await import("../../packages/audit-verifier/src");
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const rt=postgres(direct(process.env.DATABASE_URL!),{max:2,prepare:false,onnotice:()=>{},connection:{options:`-c role=${RUNTIME_ROLE}`}});
const TENANT=crypto.randomUUID(),OTHER=crypto.randomUUID();
const ctx={tenantId:TENANT,actorId:crypto.randomUUID(),actorType:"SYSTEM" as const,purpose:"TREATMENT",requestId:crypto.randomUUID()};
const cmd=(i:number)=>{const key=`audit-verify-${TENANT}-${i}`;const d=(s:string)=>{const h=crypto.createHash("sha256").update(`${key}:${s}`).digest("hex");return`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
 return{commandId:d("c"),idempotencyKey:key,aggregateId:d("agg"),aggregateType:"Patient",expectedVersion:0,eventId:d("e"),eventType:"PATIENT_REGISTERED",payload:{kind:"REGISTERED",name:`Prueba ${i}`,birthDate:"1980-01-01"},outboxId:d("o"),topic:"patient.registered",auditId:d("a"),correlationId:d("x"),occurredAt:new Date().toISOString()};};
try{
 // 1) cadena vacía del tenant nuevo: válida, en génesis
 let v=await verifyTenantAuditChain(rt,ctx);ok(v.ok&&v.checked===0&&v.lastHash===AUDIT_GENESIS,"EMPTY_CHAIN_IS_GENESIS");
 // 2) cinco comandos reales -> cinco entradas encadenadas, y el verificador recalcula EXACTAMENTE lo que escribió la función SQL
 const hashes:string[]=[];
 for(let i=0;i<5;i++){const r=await executeAtomicClinicalCommand(rt,ctx,cmd(i));hashes.push(String((r.response as{auditHash?:string}).auditHash));}
 v=await verifyTenantAuditChain(rt,ctx);
 ok(v.ok&&v.checked===5,"FIVE_ENTRIES_VERIFIED");
 ok(v.ok&&v.lastHash===hashes[4],"LAST_HASH_MATCHES_KERNEL_RESPONSE");
 // 3) la fórmula es la misma: la huella que devolvió el kernel es la que la base recalcula para cada fila
 const rows=await rt.begin(async tx=>{await tx`select set_config('app.tenant_id',${TENANT},true),set_config('app.actor_id',${ctx.actorId},true),set_config('app.purpose','TREATMENT',true),set_config('app.request_id',${ctx.requestId},true)`;return tx`select sequence::int as sequence,previous_hash,entry_hash from audit_chain_v3 where tenant_id=${TENANT} order by sequence`;}) as unknown as{sequence:number;previous_hash:string;entry_hash:string}[];
 ok(rows.map(r=>r.entry_hash).join()===hashes.join()&&rows[0]!.previous_hash===AUDIT_GENESIS&&rows.every((r,i)=>i===0||r.previous_hash===rows[i-1]!.entry_hash),"CHAIN_LINKS_STORED_CORRECTLY");
 // 4) el verificador PURO detecta una alteración (simulada sobre las filas leídas: la base no permite alterarlas, ver 5)
 const tampered=rows.map((r,i)=>({sequence:r.sequence,previousHash:r.previous_hash,entryHash:r.entry_hash,recomputedHash:i===2?"0".repeat(64):r.entry_hash}));
 const t=verifyChain(tampered);ok(!t.ok&&t.brokenAtSequence===3&&t.reason==="HASH_MISMATCH","TAMPER_DETECTED_AT_SEQUENCE_3");
 // 5) append-only con el rol de la aplicación: ni UPDATE ni DELETE
 let blocked=0;
 for(const q of[()=>rt.begin(async tx=>{await tx`select set_config('app.tenant_id',${TENANT},true)`;await tx`update audit_chain_v3 set payload='{}'::jsonb where tenant_id=${TENANT} and sequence=1`;}),
               ()=>rt.begin(async tx=>{await tx`select set_config('app.tenant_id',${TENANT},true)`;await tx`delete from audit_chain_v3 where tenant_id=${TENANT} and sequence=1`;})]){
  try{await q();}catch{blocked++;}
 }
 ok(blocked===2,"APPEND_ONLY_UPDATE_AND_DELETE_REJECTED");
 v=await verifyTenantAuditChain(rt,ctx);ok(v.ok&&v.checked===5,"CHAIN_INTACT_AFTER_ATTEMPTS");
 // 6) aislamiento: otro tenant no ve (ni verifica) esta cadena
 const o=await verifyTenantAuditChain(rt,{...ctx,tenantId:OTHER});ok(o.ok&&o.checked===0,"OTHER_TENANT_SEES_NOTHING");
}catch(e){result.status="FAIL";result.error=String(e);}finally{await rt.end();}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
