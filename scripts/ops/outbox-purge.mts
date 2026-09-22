// Retención del outbox (auditoría D-03 / D-09): borra mensajes PENDING más antiguos que N días. Seguro porque los
// consumidores de este sistema reconstruyen desde clinical_events (fuente de verdad), no desde el outbox (ver ADR-0031,
// addendum 2026-09-22). Requiere el rol propietario (el de la aplicación no tiene DELETE sobre outbox).
//   pnpm outbox:purge -- --older-than-days 30 --yes
import fs from"node:fs";import path from"node:path";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{/* sin .env.local */}
const args=process.argv.slice(2);const i=args.indexOf("--older-than-days");const days=i>=0?Number(args[i+1]):NaN;
if(!Number.isInteger(days)||days<1){console.error("Uso: pnpm outbox:purge -- --older-than-days N --yes  (N >= 1)");process.exit(2);}
if(!args.includes("--yes")){console.error("Añada --yes para confirmar el borrado");process.exit(2);}
if(!process.env.DATABASE_URL){console.error("DATABASE_URL no definida");process.exit(2);}
const direct=(u:string)=>u.replace("-pooler","").replace(/([?&])channel_binding=require/,"$1").replace(/[?&]$/,"");
const{default:postgres}=await import("postgres");
const sql=postgres(direct(process.env.DATABASE_URL),{max:1,prepare:false,onnotice:()=>{}});
try{
 const r=await sql`delete from outbox where state='PENDING' and created_at<now()-make_interval(days=>${days}) returning tenant_id`;
 console.log(JSON.stringify({purged:r.length,olderThanDays:days,tenants:new Set(r.map(x=>String(x.tenant_id))).size,at:new Date().toISOString()}));
}catch(e){console.error(JSON.stringify({status:"ERROR",error:String(e)}));process.exit(1);}
finally{await sql.end();}
