// Gate de regresión en vivo (smoke) para CI — ENG-056 (integration/clinical-regression gate requerido) y
// EXEC operating model paso 7. Corre TODAS las pruebas en vivo contra la base desechable (TEST_DATABASE_URL).
//
// Convención de exit de cada proof: 0 = PASS, 3 = SKIP (NOT_RUN, sin TEST_DATABASE_URL), 2 = REFUSED (apunta a la base de
// la aplicación), otro = FAIL. El gate falla si CUALQUIER proof falla. Un SKIP con TEST_DATABASE_URL presente es FAIL.
import fs from"node:fs";import path from"node:path";import{spawnSync}from"node:child_process";
// Auditoría 2026-09-19 (P-08): el smoke cubría 57 de 87 pruebas con una lista escrita a mano. Ahora DESCUBRE todas las
// `live-*-proof.mts` del repo: una prueba nueva entra en el gate sin tocar este fichero; una prueba borrada sale sola.
const SMOKE=fs.readdirSync("scripts/v22").filter(f=>/^live-.*-proof\.mts$/.test(f)).sort().map(f=>f.replace(/\.mts$/,""));
// P-07: la base la decide TEST_DATABASE_URL (desechable). DATABASE_URL de la app no cuenta.
const hasDb=!!process.env.TEST_DATABASE_URL;
const results:{name:string;status:"PASS"|"FAIL"|"SKIP";code:number}[]=[];
for(const name of SMOKE){
 const r=spawnSync("pnpm",["-s","exec","tsx",`scripts/v22/${name}.mts`],{encoding:"utf8",env:process.env});
 const code=r.status??1;
 // exit 3 = NOT_RUN. Solo aceptable si de verdad no hay DATABASE_URL; con DB presente, saltarse = FAIL.
 const status:"PASS"|"FAIL"|"SKIP"=code===0?"PASS":(code===3&&!hasDb?"SKIP":"FAIL");
 results.push({name,status,code});
 const tail=(r.stdout??"").trim().split("\n").slice(-1)[0]??"";
 console.log(`${status==="PASS"?"✓":status==="SKIP"?"—":"✗"} ${name} (exit ${code}) ${status==="FAIL"?tail:""}`);
 if(status==="FAIL"&&r.stderr)console.log(r.stderr.trim().split("\n").slice(-8).join("\n"));
}
// Auditoría 2026-09-19, anexo R11 (R11-22) — EL LIBRO DE EJECUCIÓN, para que «evidencia» signifique «se ejecutó y pasó».
//
// El dossier de aceptación C5 certificaba «evidencia COMPLETA» comprobando que el archivo de prueba EXISTIERA en disco.
// Un archivo que existe y falla —o que nadie ha ejecutado nunca— contaba igual que una prueba verde. Es el mismo defecto
// que el drill de restauración: un gate que no puede fallar. Aquí se deja constancia de lo que de verdad corrió, con su
// código de salida, y el dossier lo exige.
//
// NO se escribe la cadena de conexión ni nada derivado de ella: solo si el destino era el clúster efímero local, que es la
// única forma admitida de correr esto (P-07). Una credencial en un archivo versionado sería un defecto peor que el que se
// está corrigiendo.
const objetivo=(():"local-ephemeral"|"other"|"none"=>{
 const u=process.env.TEST_DATABASE_URL;
 if(!u)return "none";
 return /@(127\.0\.0\.1|localhost)[:/]/.test(u)?"local-ephemeral":"other";
})();
const LEDGER="release/evidence/live-smoke-ledger.json";
fs.mkdirSync(path.dirname(LEDGER),{recursive:true});
fs.writeFileSync(LEDGER,JSON.stringify({
 generatedAt:new Date().toISOString(),
 target:objetivo,
 total:SMOKE.length,
 results:results.map(r=>({proof:`scripts/v22/${r.name}.mts`,status:r.status,exitCode:r.code})),
 // El propio runner es un GATE, y hay capacidades que lo citan como evidencia. Se registra con su veredicto agregado: es
 // su código de salida, no una autocertificación del contenido de las pruebas.
 gates:[{gate:"scripts/ci/live-smoke.mts",status:results.some(x=>x.status==="FAIL")?"FAIL":"PASS",passed:results.filter(x=>x.status==="PASS").length,total:SMOKE.length}],
},null,2)+"\n");
const failed=results.filter(x=>x.status==="FAIL");
const passed=results.filter(x=>x.status==="PASS").length;
const skipped=results.filter(x=>x.status==="SKIP").length;
console.log(`\nSMOKE: ${passed} PASS · ${failed.length} FAIL · ${skipped} SKIP (de ${SMOKE.length})`);
if(!hasDb&&skipped===SMOKE.length){console.log("NOTA: sin TEST_DATABASE_URL, todo SKIP (no es un gate real).");process.exit(0);}
process.exit(failed.length?1:0);
