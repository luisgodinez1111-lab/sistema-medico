// Auditoría 2026-09-19 (P-06, D-08) — `pnpm db:migrate`: el ÚNICO mecanismo versionado que aplica db/migrations/*.sql.
//
// Antes ningún script migraba la base real: el esquema de producción dependía de pasos manuales no documentados y no había
// forma de saber si coincidía con el repo. Ahora:
//   · tabla de control `schema_migrations` (versión, fichero, sha256, cuándo, quién, nota);
//   · cada migración pendiente se aplica en UNA transacción junto con su fila de control (todo o nada);
//   · las ya aplicadas se comprueban por sha256 contra el fichero del repo: una migración editada tras aplicarse es DERIVA
//     y detiene el proceso (nunca se "re-aplica" en silencio);
//   · `baseline` registra como aplicadas, SIN ejecutarlas, las migraciones que una base existente ya lleva (primer uso en
//     producción, que se migró a mano hasta 0018).
//
// Uso:  pnpm db:migrate -- status                      estado (aplicadas / pendientes / deriva); no modifica nada
//       pnpm db:migrate -- up [--yes]                  aplica las pendientes en orden
//       pnpm db:migrate -- baseline --through 0018 --yes
// Conexión: DATABASE_URL (rol propietario del esquema; se usa el host directo, no el pooler). Contra un host que no sea
// local exige --yes y muestra el host antes de tocar nada. Salida: 0 ok · 1 deriva o error · 2 uso incorrecto.
import fs from"node:fs";import path from"node:path";import os from"node:os";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{/* sin .env.local: se usa el entorno */}
const args=process.argv.slice(2);const cmd=args[0]??"status";const flag=(n:string)=>args.includes(n);const opt=(n:string)=>{const i=args.indexOf(n);return i>=0?args[i+1]:undefined;};
const direct=(u:string)=>u.replace("-pooler","").replace(/([?&])channel_binding=require/,"$1").replace(/[?&]$/,"");
function fail(msg:string,code=1):never{console.error(JSON.stringify({status:"ERROR",message:msg}));process.exit(code);}
if(!["status","up","baseline"].includes(cmd))fail("Uso: db:migrate -- status | up [--yes] | baseline --through NNNN --yes",2);
const url=process.env.DATABASE_URL;if(!url)fail("DATABASE_URL no definida",2);
const host=(()=>{try{return new URL(direct(url)).hostname;}catch{return"?";}})();
const isLocal=host==="localhost"||host==="127.0.0.1"||host==="::1";
if(cmd!=="status"&&!isLocal&&!flag("--yes"))fail(`Destino ${host}: añada --yes para confirmar que quiere migrar ESTA base`,2);

const{readMigrationFiles,stripOwnTransaction,createdTables}=await import("../../packages/db-migrations/src");

const{default:postgres}=await import("postgres");
const sql=postgres(direct(url),{max:1,prepare:false,onnotice:()=>{}});
async function main(){
try{
 await sql.unsafe(`create table if not exists schema_migrations(
  version text primary key, filename text not null, sha256 text not null,
  applied_at timestamptz not null default now(), applied_by text not null, note text)`);
 let files:ReturnType<typeof readMigrationFiles>=[];try{files=readMigrationFiles();}catch(e){fail(String(e instanceof Error?e.message:e));}
 const applied=await sql`select version,filename,sha256,applied_at,note from schema_migrations order by version` as unknown as{version:string;filename:string;sha256:string;applied_at:string;note:string|null}[];
 const byVersion=new Map(applied.map(a=>[a.version,a]));
 const drift=files.filter(f=>byVersion.has(f.version)&&byVersion.get(f.version)!.sha256!==f.sha256).map(f=>f.filename);
 const orphan=applied.filter(a=>!files.some(f=>f.version===a.version)).map(a=>a.filename);
 const pending=files.filter(f=>!byVersion.has(f.version));
 const report=()=>console.log(JSON.stringify({host,applied:applied.length,pending:pending.map(p=>p.filename),drift,orphan},null,2));
 if(cmd==="status"){report();process.exitCode=drift.length||orphan.length?1:0;return;}
 if(drift.length)fail(`DERIVA: migraciones ya aplicadas cuyo fichero cambió: ${drift.join(", ")}. Las migraciones aplicadas no se editan; escriba una nueva.`);
 if(orphan.length)fail(`Migraciones registradas en la base que no existen en el repo: ${orphan.join(", ")}`);
 const who=`${os.userInfo().username}@${os.hostname()}`;
 if(cmd==="baseline"){
  const through=opt("--through");if(!through||!/^\d{4}$/.test(through))fail("baseline exige --through NNNN",2);
  const toMark=pending.filter(f=>f.version<=through);
  // Guarda: "baseline" AFIRMA que la base ya lleva esas migraciones. Se comprueba lo verificable: toda tabla que esas
  // migraciones crean debe existir. Si falta alguna, la afirmación es falsa y no se registra nada.
  const expected=[...new Set(toMark.flatMap(f=>createdTables(f.body)))];
  const missing:string[]=[];
  for(const tname of expected){const r=await sql`select to_regclass(${"public."+tname}) as t`;if(!r[0]?.t)missing.push(tname);}
  if(missing.length)fail(`baseline rechazado: la base NO tiene tablas que las migraciones hasta ${through} crean: ${missing.join(", ")}`);
  await sql.begin(async tx=>{for(const f of toMark)await tx`insert into schema_migrations(version,filename,sha256,applied_by,note) values(${f.version},${f.filename},${f.sha256},${who},${"baseline: registrada como aplicada sin ejecutar"})`;});
  console.log(JSON.stringify({host,baselined:toMark.map(f=>f.filename)},null,2));return;
 }
 // up
 const done:string[]=[];
 for(const f of pending){
  const t0=Date.now();
  await sql.begin(async tx=>{
   await tx.unsafe(stripOwnTransaction(f.body));
   await tx`insert into schema_migrations(version,filename,sha256,applied_by) values(${f.version},${f.filename},${f.sha256},${who})`;
  });
  done.push(`${f.filename} (${Date.now()-t0} ms)`);
 }
 console.log(JSON.stringify({host,applied:done,total:applied.length+done.length},null,2));
}catch(e){process.exitCode=1;console.error(JSON.stringify({status:"ERROR",message:String(e instanceof Error?e.message:e)}));}
finally{await sql.end();}
}
await main();
