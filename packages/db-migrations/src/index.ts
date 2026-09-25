import fs from"node:fs";import path from"node:path";import crypto from"node:crypto";
// Auditoría 2026-09-19 (P-06, D-08) — núcleo PURO del migrador (`scripts/db/migrate.mts`) y del test de integridad.
export const MIGRATION_FILE_RE=/^(\d{4})_[a-z0-9_]+\.sql$/;
export type MigrationFile=Readonly<{version:string;filename:string;sha256:string;body:string}>;
export function readMigrationFiles(dir="db/migrations"):MigrationFile[]{
 const files=fs.readdirSync(dir).filter(f=>MIGRATION_FILE_RE.test(f)).sort();
 const out=files.map(filename=>{const body=fs.readFileSync(path.join(dir,filename),"utf8");return{version:MIGRATION_FILE_RE.exec(filename)![1]!,filename,sha256:crypto.createHash("sha256").update(body).digest("hex"),body};});
 const seen=new Set<string>();for(const f of out){if(seen.has(f.version))throw new Error(`Dos migraciones con la misma versión ${f.version}`);seen.add(f.version);}
 return out;
}
// Las migraciones se escriben con BEGIN;/COMMIT; propios (o sin ellos). El migrador las ejecuta dentro de SU transacción
// junto con la fila de control, así que retira SOLO las líneas sueltas `BEGIN;` y `COMMIT;` (nunca las de un bloque
// plpgsql, que van dentro de DO $$ … $$ y no ocupan una línea propia terminada en punto y coma).
export function stripOwnTransaction(body:string):string{return body.split("\n").filter(l=>!/^\s*(BEGIN|COMMIT)\s*;\s*(--.*)?$/i.test(l)).join("\n");}
// Manifiesto: TODAS las migraciones con su sha256 (D-08: el manifest.v17 cubría 13 de 18 y no detectaba deriva).
export type Manifest=Readonly<{algorithm:"sha256";migrations:readonly Readonly<{file:string;sha256:string}>[]}>;
export function buildManifest(files:readonly MigrationFile[]):Manifest{return{algorithm:"sha256",migrations:files.map(f=>({file:f.filename,sha256:f.sha256}))};}
export function manifestDrift(manifest:Manifest,files:readonly MigrationFile[]):{missing:string[];changed:string[];extra:string[]}{
 const m=new Map(manifest.migrations.map(x=>[x.file,x.sha256]));
 return{missing:files.filter(f=>!m.has(f.filename)).map(f=>f.filename),changed:files.filter(f=>m.has(f.filename)&&m.get(f.filename)!==f.sha256).map(f=>f.filename),extra:[...m.keys()].filter(k=>!files.some(f=>f.filename===k))};
}
// Nombres de tabla creados por cada migración (para vigilar colisiones: D-05).
// Auditoría 2026-09-19, anexo R06 (lote 12e): se escaneaba el cuerpo CRUDO y el `IF NOT EXISTS` tenía que llevar
// exactamente un espacio. Un COMENTARIO que mencionara «CREATE TABLE IF NOT EXISTS» producía el nombre fantasma `if`
// —lo hace la 0020 al explicar el hallazgo D-05—. No es cosmético: `db:migrate baseline` EXIGE que exista toda tabla de
// esta lista antes de registrar nada, así que el fantasma rompía el baseline, que es el procedimiento documentado para la
// base de producción (migrada a mano hasta 0018); y el guardarraíl de colisiones de nombre comparaba contra un inventado.
// Se retiran los comentarios antes de escanear y el espaciado pasa a ser libre.
export function createdTables(body:string):string[]{
 const sql=body.replace(/--[^\n]*/g,"").replace(/\/\*[\s\S]*?\*\//g,"");
 return[...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([a-z_0-9]+)/gi)].map(m=>m[1]!.toLowerCase());
}
// Tablas RENOMBRADAS por una migración (0028 retiró las heredadas renombrándolas). Sin esto, el drill de restauración las
// daría por «ajenas al repo» —como las tres de 0022— cuando en realidad las crea y las renombra el propio repositorio.
export function renamedTables(body:string):string[]{
 const sql=body.replace(/--[^\n]*/g,"").replace(/\/\*[\s\S]*?\*\//g,"");
 const nombres=[...sql.matchAll(/ALTER TABLE\s+(?:public\.)?([a-z_0-9]+)\s+RENAME TO\s+([a-z_0-9]+)/gi)].map(m=>m[2]!.toLowerCase());
 // La 0028 renombra con `format(... %I, t, destino)`: el nombre destino se deriva de un sufijo declarado en el propio SQL.
 for(const m of sql.matchAll(/([a-z_0-9]+)\|\|'(_retirada_\d{4})'/gi))nombres.push("*"+m[2]!.toLowerCase());
 return nombres;
}
// Tablas RETIRADAS del esquema vigente: las que una migración renombra en bloque recorriendo un `ARRAY[...]` de nombres.
// Sin esto, «cuántas tablas debería tener el esquema» solo se puede contar a mano contra la base que uno tenga delante, y un
// número contado a mano se recalibra cada vez que falla —que es exactamente cómo un umbral deja de ser una comprobación—.
// Devuelve los nombres ORIGEN (no los `*_retirada_NNNN`), porque es lo que hay que restar a las tablas creadas.
export function retiredTables(body:string):string[]{
 const sql=body.replace(/--[^\n]*/g,"").replace(/\/\*[\s\S]*?\*\//g,"");
 // Solo cuenta si el bucle construye un destino con sufijo de retiro; así un `FOREACH` con otro propósito no se confunde.
 if(!/\|\|'_retirada_\d{4}'/i.test(sql))return[];
 const out:string[]=[];
 for(const m of sql.matchAll(/ARRAY\s*\[([^\]]*)\]/gi))
  for(const lit of m[1]!.matchAll(/'([a-z_0-9]+)'/gi))out.push(lit[1]!.toLowerCase());
 return[...new Set(out)];
}
