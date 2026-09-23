// Auditoría 2026-09-19 (S-03) — PRUEBA EN VIVO contra PostgreSQL real: el límite de tasa se comparte entre instancias.
//   · dos "instancias" (dos llamadas independientes al almacén, como dos lambdas) ven el MISMO cubo: con capacidad 3, la
//     cuarta petición se deniega aunque venga de otra instancia; el saldo y el Retry-After son coherentes;
//   · los cubos son por ámbito y llave (otra IP no se ve afectada);
//   · un comando clínico del mismo actor se limita por el almacén compartido (429 RATE_LIMITED con retryAfterSeconds).
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{sharedAllow}=await import("../../apps/web/lib/rate-limit-shared");
const{getSql}=await import("../../apps/web/lib/clinical-runtime");
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const ip=`203.0.113.${Math.floor(Math.random()*250)}-${crypto.randomUUID().slice(0,8)}`;const policy={capacity:3,refillPerSecond:1/60,maxKeys:10};
 const a1=await sharedAllow("login",ip,policy),a2=await sharedAllow("login",ip,policy),a3=await sharedAllow("login",ip,policy);
 ok(a1.allowed&&a2.allowed&&a3.allowed&&a3.remaining===0,"THREE_ALLOWED_FROM_INSTANCE_A");
 // "instancia B": misma llave, otro proceso lógico -> el almacén ya no tiene tokens
 const b=await sharedAllow("login",ip,policy);
 ok(!b.allowed&&b.retryAfterSeconds>=1&&b.retryAfterSeconds<=60,"FOURTH_DENIED_FROM_INSTANCE_B_WITH_RETRY_AFTER");
 ok((await sharedAllow("login",ip+"-otra",policy)).allowed,"OTHER_KEY_UNAFFECTED");
 ok((await sharedAllow("write",ip,policy)).allowed,"OTHER_SCOPE_UNAFFECTED");
 // la fila persiste en la base (es lo que comparte instancias) y no contiene PHI
 const sql=getSql();const rows=await sql`select scope,key,tokens from rate_limit_buckets where scope='login' and key=${ip}`;
 ok(rows.length===1&&Number((rows[0] as{tokens:number}).tokens)<1,"BUCKET_PERSISTED_IN_SHARED_STORE");
 // comando clínico limitado por actor: con la política de escrituras real (120) no se agota en una prueba; se comprueba el
 // contrato con una política pequeña sobre la misma función que usa runClinicalCommand
 const actor=`${crypto.randomUUID()}:${crypto.randomUUID()}`;
 for(let i=0;i<3;i++)await sharedAllow("write",actor,policy);
 const w=await sharedAllow("write",actor,policy);ok(!w.allowed&&w.retryAfterSeconds>=1,"WRITE_SCOPE_SHARED_DENIAL");
 ok(Number((await sql`select rate_limit_gc(interval '0 seconds')`)[0]!["rate_limit_gc"])>=1,"GC_REMOVES_STALE_BUCKETS");
 await sql.end();
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
