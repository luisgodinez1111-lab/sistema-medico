// Herramienta de operación (auditoría S-07): verifica la cadena de auditoría inmutable de UN tenant contra la base de datos
// indicada por DATABASE_URL, recalculando cada huella en la base con la misma expresión que la escribió.
//   pnpm audit:verify -- <tenantId>
// Solo lectura. Sale con 0 si la cadena es íntegra, 1 si está rota, 2 si faltan argumentos o conexión.
import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
import{directEndpoint as direct}from"../../packages/pg-endpoint/src";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{/* sin .env.local: se usa el entorno */}
const tenantId=process.argv.slice(2).filter(a=>a!=="--")[0]; // pnpm 10 reenvía el "--" literal
if(!tenantId||!/^[0-9a-f-]{36}$/i.test(tenantId)){console.error("Uso: pnpm audit:verify -- <tenantId (uuid)>");process.exit(2);}
if(!process.env.DATABASE_URL){console.error("DATABASE_URL no definida");process.exit(2);}
const{default:postgres}=await import("postgres");
const{verifyTenantAuditChain}=await import("../../packages/audit-verifier/src");
const sql=postgres(direct(process.env.DATABASE_URL),{max:1,prepare:false,onnotice:()=>{},connection:{options:"-c role=medical_os_runtime"}});
try{
 const v=await verifyTenantAuditChain(sql,{tenantId,actorId:crypto.randomUUID(),purpose:"OPERATIONS",requestId:crypto.randomUUID()});
 console.log(JSON.stringify({...v,verifiedAt:new Date().toISOString()},null,2));
 process.exit(v.ok?0:1);
}catch(e){console.error(JSON.stringify({status:"ERROR",error:String(e)}));process.exit(2);}
finally{await sql.end();}
