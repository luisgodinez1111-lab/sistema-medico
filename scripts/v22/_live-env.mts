// Auditoría 2026-09-19 (P-07, P-08) — PRÓLOGO ÚNICO de las pruebas en vivo (`live-*-proof.mts`).
//
// Antes, las 87 pruebas cargaban DATABASE_URL de .env.local (la base de la APLICACIÓN), ninguna usaba TEST_DATABASE_URL y
// ninguna limpiaba: cada corrida dejaba un tenant sintético para siempre en el event store de producción. Como la cadena de
// auditoría es append-only por diseño (no se puede borrar), la única aislación honesta es POR BASE DE DATOS: las pruebas
// corren contra una base DESECHABLE (contenedor de CI, clúster local efímero o rama de Neon dedicada), nunca contra la de
// la aplicación. Este módulo lo impone:
//   1) carga .env.local sin pisar variables ya definidas;
//   2) exige TEST_DATABASE_URL (sin ella: NOT_RUN, código 3);
//   3) se NIEGA (código 2) si TEST_DATABASE_URL apunta al mismo host que DATABASE_URL de la aplicación, salvo que el host
//      sea local (127.0.0.1/localhost = desechable por definición) o se declare LIVE_PROOF_ALLOW_SHARED_DB=1 a sabiendas;
//   4) redirige DATABASE_URL a TEST_DATABASE_URL para el código de la aplicación (clinical-runtime lee DATABASE_URL).
// Se importa con `import "./_live-env.mts"` como PRIMERA sentencia de cada prueba: los módulos de la app se cargan después
// con `await import(...)`, ya con el entorno redirigido.
import fs from"node:fs";import path from"node:path";
try{const e=fs.readFileSync(path.resolve(".env.local"),"utf8");for(const l of e.split("\n")){const m=/^([A-Za-z0-9_]+)=(.*)$/.exec(l.trim());if(m&&m[1]&&!process.env[m[1]])process.env[m[1]]=m[2]!.replace(/^["']|["']$/g,"");}}catch{/* sin .env.local: se usa el entorno */}
const host=(u:string|undefined)=>{try{return u?new URL(u.replace("-pooler","")).hostname.toLowerCase():"";}catch{return"";}};
const isLocal=(h:string)=>h==="localhost"||h==="127.0.0.1"||h==="::1"||h.endsWith(".localhost");
const test=process.env.TEST_DATABASE_URL;
if(!test){console.log(JSON.stringify({status:"NOT_RUN",reason:"TEST_DATABASE_URL_MISSING",hint:"las pruebas en vivo solo corren contra una base DESECHABLE declarada en TEST_DATABASE_URL"}));process.exit(3);}
const th=host(test),ah=host(process.env.DATABASE_URL);
if(!isLocal(th)&&ah&&th===ah&&process.env.LIVE_PROOF_ALLOW_SHARED_DB!=="1"){
 console.log(JSON.stringify({status:"REFUSED",reason:"TEST_DATABASE_URL_IS_APP_DATABASE",host:th,hint:"apunte TEST_DATABASE_URL a una rama/contenedor desechable; LIVE_PROOF_ALLOW_SHARED_DB=1 solo si sabe lo que hace"}));process.exit(2);
}
process.env.DATABASE_URL=test;
