// Auditoría 2026-09-19, anexo R06 (vacíos F10 y F15) — PURGA de las filas de idempotencia ya caducadas.
//
// El problema, medido: `command_idempotency` recibe UNA FILA POR COMANDO (el kernel reclama la clave antes de escribir), con
// `expires_at` a 24 h… y nada las borraba nunca. En la base de integración de esta remediación había 83 633 filas, 22 568 de
// ellas caducadas. Esa tabla está en el camino de ESCRITURA de todos los comandos: crece sin límite y degrada cada commit,
// además de conservar `request_hash` de peticiones antiguas sin ninguna razón para hacerlo.
// `idempotency_keys` es la tabla equivalente del andamio (legado D-01, sin lectores) y se purga igual.
// `outbox` con `dead_letter_at` son mensajes que ya nadie va a entregar: se purgan con su propia ventana.
//
// Requiere el rol PROPIETARIO: el de la aplicación no tiene DELETE sobre estas tablas (privilegio mínimo, R06-10).
//   pnpm idempotency:purge --older-than-days 7 --yes
//   pnpm idempotency:purge --older-than-days 7            (simulación: cuenta sin borrar)
import fs from"node:fs";import path from"node:path";
import{directEndpoint as direct}from"../../packages/pg-endpoint/src";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{/* .env.local es opcional */}
const args=process.argv.slice(2).filter(a=>a!=="--"); // pnpm 10 reenvía el "--" literal
const i=args.indexOf("--older-than-days");const days=i>=0?Number(args[i+1]):NaN;
if(!Number.isInteger(days)||days<1){console.error("Uso: pnpm idempotency:purge --older-than-days N [--yes]  (N >= 1; sin --yes solo simula)");process.exit(2);}
if(!process.env.DATABASE_URL){console.error("DATABASE_URL no definida");process.exit(2);}
const aplicar=args.includes("--yes");
const{default:postgres}=await import("postgres");
const sql=postgres(direct(process.env.DATABASE_URL),{max:1,prepare:false,onnotice:()=>{}});
type Tabla=Readonly<{tabla:string;condicion:string;motivo:string}>;
// La condición de cada purga: SIEMPRE una fila ya caducada, nunca una viva. La ventana extra (`--older-than-days`) es un
// margen de seguridad sobre `expires_at`: una clave caducada hace un minuto podría estar en un reintento en vuelo.
const TABLAS:readonly Tabla[]=[
 {tabla:"command_idempotency",condicion:"expires_at < now() - make_interval(days=>$1)",motivo:"clave de idempotencia caducada: el reintento ya no puede reclamarla"},
 {tabla:"idempotency_keys",   condicion:"expires_at < now() - make_interval(days=>$1)",motivo:"tabla de andamio (legado D-01, sin lectores en la aplicación)"},
 {tabla:"outbox",             condicion:"dead_letter_at is not null and dead_letter_at < now() - make_interval(days=>$1)",motivo:"mensaje en dead letter: nadie lo va a entregar (los consumidores reconstruyen desde clinical_events)"},
];
const salida:{mode:string;olderThanDays:number;tables:Record<string,{candidates:number;purged:number;reason:string}>;at:string}={
 mode:aplicar?"PURGE":"DRY_RUN",olderThanDays:days,tables:{},at:new Date().toISOString(),
};
try{
 for(const t of TABLAS){
  const existe=await sql`select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${t.tabla} and c.relkind='r'`;
  if(!existe.length)continue; // la tabla pudo retirarse en una limpieza posterior
  const cnt=await sql.unsafe(`select count(*)::int n from ${t.tabla} where ${t.condicion}`,[days] as never[]);
  const candidatos=Number((cnt[0] as{n:number}).n);
  let borradas=0;
  if(aplicar&&candidatos>0){
   // En lotes: un DELETE de cientos de miles de filas mantiene un lock largo sobre una tabla del camino de escritura.
   for(;;){
    const r=await sql.unsafe(`delete from ${t.tabla} where ctid in (select ctid from ${t.tabla} where ${t.condicion} limit 5000)`,[days] as never[]);
    const n=(r as unknown as{count:number}).count??0;
    borradas+=n;
    if(n===0)break;
   }
  }
  salida.tables[t.tabla]={candidates:candidatos,purged:borradas,reason:t.motivo};
 }
 console.log(JSON.stringify(salida,null,1));
}catch(e){console.error(JSON.stringify({status:"ERROR",error:String(e)}));process.exit(1);}
finally{await sql.end();}
