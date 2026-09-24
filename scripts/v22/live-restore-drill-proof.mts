// Auditoría 2026-09-19, anexo R06 (R06-F12, R06-F19, y la 2.ª mitad de R06-16) — el drill de restauración pasa a ser
// EVIDENCIA EJECUTADA en el gate, no un procedimiento escrito.
//
// EL HALLAZGO, con su prueba. `docs/runbooks/backup-dr.md` §3 declara que una restauración es aceptable «solo si
// restoreErrors() devuelve vacío», y el único sitio que llama a restoreErrors() contra un restore de verdad es
// `scripts/v22/restore-drill.mts`. Ese drill exigía DATABASE_URL + RESTORE_DATABASE_URL (un branch de Neon), así que
// NINGÚN gate lo ejecutaba nunca. Consecuencia medida: en el lote 12b el payload sembrado pasó a llevar `kind` (lo exige la
// validación de esquema de R06-19) y la expectativa del replay, escrita a mano en el commit original, se quedó atrás. El
// drill llevaba desde entonces fallando REPLAY/OBLIGATIONS y nadie podía saberlo. Un gate de recuperabilidad que nadie
// ejecuta no es una garantía: es la «falla abierta presentada como seguridad» que la auditoría nombró.
//
// QUÉ HACE. Crea una base OBJETIVO en el mismo clúster desechable y ejecuta el drill real —el mismo fichero que documenta
// el runbook, sin copiar su lógica— con esa base como target. El objetivo lleva nombre único por corrida por dos razones:
// el drill es destructivo sobre su target (nunca se reutiliza uno), y así se ejercita siempre el camino «target vacío» =
// reconstrucción completa del esquema desde las migraciones con el migrador versionado.
// Después comprueba `pnpm db:check` CONTRA LA BASE RESTAURADA, que es lo que R06-16 pedía y antes era imposible: el drill
// aplicaba los ficheros .sql por su cuenta, así que la base reconstruida no tenía `schema_migrations` y db:check fallaba
// con «tabla de control ausente».
import crypto from"node:crypto";import{spawnSync}from"node:child_process";
import{directEndpoint as direct}from"../../packages/pg-endpoint/src";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
import{readMigrationFiles}from"../../packages/db-migrations/src";
const{default:postgres}=await import("postgres");
const result:{status:string;checks:string[];target?:string;proof?:unknown;error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}

const SOURCE=direct(process.env.DATABASE_URL!); // ya redirigido a TEST_DATABASE_URL por _live-env
/** Cambia SOLO el nombre de base de la URL, conservando credenciales, puerto y parámetros (sslmode…). */
const conDb=(url:string,db:string)=>url.replace(/(^postgres(?:ql)?:\/\/[^/]+\/)[^?]*/,`$1${db}`);
const srcDb=(/^postgres(?:ql)?:\/\/[^/]+\/([^?]*)/.exec(SOURCE)?.[1])||"";
if(!srcDb){console.log(JSON.stringify({status:"NOT_RUN",reason:"TEST_DATABASE_URL_SIN_NOMBRE_DE_BASE"}));process.exit(3);}
const targetDb=`${srcDb.slice(0,32)}_drill_${crypto.randomBytes(4).toString("hex")}`;
result.target=targetDb;

try{
 // 1) Base objetivo en el mismo clúster desechable. CREATE DATABASE no cabe en una transacción, así que va por `unsafe`.
 //    Si el rol no puede crear bases, esto FALLA a propósito: un gate que se desvanece en silencio es el defecto que
 //    este fichero viene a cerrar.
 const admin=postgres(conDb(SOURCE,"postgres"),{max:1,prepare:false,onnotice:()=>{}});
 try{await admin.unsafe(`CREATE DATABASE "${targetDb}"`);}finally{await admin.end();}
 ok(true,`base objetivo creada: ${targetDb} (desechable, nombre único por corrida)`);

 // 2) EL DRILL REAL, como proceso hijo. Las dos URLs van explícitas en el entorno: el drill carga .env.local pero no pisa
 //    variables ya definidas, así que no puede acabar apuntando a la base de la aplicación.
 const TARGET=conDb(SOURCE,targetDb);
 const r=spawnSync("pnpm",["-s","exec","tsx","scripts/v22/restore-drill.mts"],{encoding:"utf8",env:{...process.env,DATABASE_URL:SOURCE,RESTORE_DATABASE_URL:TARGET}});
 const salida=(r.stdout??"").trim();
 ok((r.status??1)===0,`el drill termina en 0 (cola: ${salida.slice(-260)}${(r.stderr??"").trim().slice(-160)})`);
 const out=JSON.parse(salida) as{status:string;errors?:string[];note?:string;proof?:Record<string,unknown>};
 result.proof=out.proof;
 const p=out.proof??{};
 ok(out.status==="PASS",`status PASS del drill (errores: ${JSON.stringify(out.errors??[])})`);
 ok((out.errors??[]).length===0,"restoreErrors() vacío: la restauración es admisible (criterio del runbook §3)");

 // 3) Cada dimensión del gate, por separado: un PASS global no dice cuál se verificó.
 ok(p["schemaHash"]===p["expectedSchemaHash"],"esquema restaurado idéntico al vivo (columnas + RLS + políticas + grants)");
 ok(p["policiesComplete"]===true,`ninguna tabla con RLS queda sin política tras restaurar (R06-17): ${JSON.stringify(p["rlsTablesWithoutPolicy"]??[])}`);
 ok(p["ledgerMatch"]===true,`el registro de migraciones de la base restaurada coincide con el origen y con el repo (R06-F20): ${JSON.stringify(p["ledgerDivergence"]??[])}`);
 ok(p["auditValid"]===true,"la cadena de auditoría queda encadenada tras restaurar");
 ok(p["rlsPass"]===true,"el aislamiento por tenant se mantiene tras restaurar");
 ok(p["obligationsMatch"]===true&&p["replayHash"]===p["liveHash"],"el replay determinista reproduce el mismo estado (REPLAY/OBLIGATIONS)");
 ok(/reconstruido con el migrador desde migraciones \d{4}\.\.\d{4}/.test(out.note??""),`el objetivo se reconstruyó con el MIGRADOR versionado, no leyendo los .sql a mano (nota: ${out.note??""})`);
 // Las tablas que ninguna migración crea (legado de 0022) se reportan, no se esconden: en una base nueva la lista va vacía.
 ok(Array.isArray(p["nonRepoTablesSource"]),"el drill informa qué tablas del origen no son reproducibles desde el repo (0022)");
 ok((p["nonRepoTablesLost"] as string[]|undefined)?.length===0,"ninguna tabla del origen se perdió en la restauración");

 // 4) R06-16 (2.ª mitad): la base restaurada tiene su tabla de control completa y `pnpm db:check` la aprueba.
 const esperadas=readMigrationFiles().length;
 const tgt=postgres(TARGET,{max:1,prepare:false,onnotice:()=>{}});
 try{
  const n=await tgt`select count(*)::int as n from schema_migrations`;
  ok(Number(n[0]!.n)===esperadas,`la base restaurada registra las ${esperadas} migraciones aplicadas (tenía ${n[0]!.n}); antes el drill las aplicaba a mano y no registraba ninguna`);
 }finally{await tgt.end();}
 const chk=spawnSync("pnpm",["-s","exec","tsx","scripts/db/check.mts"],{encoding:"utf8",env:{...process.env,DATABASE_URL:TARGET}});
 ok((chk.status??1)===0,`pnpm db:check PASA sobre la base restaurada (cola: ${(chk.stdout??"").trim().slice(-300)})`);

 console.log(JSON.stringify(result,null,2));
}catch(e){
 result.status="FAIL";result.error=e instanceof Error?e.message:String(e);
 console.log(JSON.stringify(result,null,2));
}
process.exit(result.status==="PASS"?0:1);
