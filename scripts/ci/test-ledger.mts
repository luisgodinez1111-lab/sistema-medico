// Auditoría 2026-09-19, anexo R11 (R11-22) — LIBRO DE EJECUCIÓN DE LAS PRUEBAS UNITARIAS.
//
// El dossier de aceptación C5 certificaba «evidencia COMPLETA» comprobando que el archivo de prueba EXISTIERA en disco. Un
// archivo que existe y falla —o que nadie ha ejecutado nunca— contaba igual que una prueba verde. Este script corre la
// batería y deja constancia, archivo por archivo, de qué se ejecutó y con qué resultado; `build-c5-dossier` lo exige y
// rechaza citar como evidencia un test que no aparezca aquí en verde.
//
// Se ejecuta `vitest run` con el reporter JSON y se reduce a lo que el dossier necesita: ruta, estado y conteo. Nada de
// contenido de las pruebas ni de datos: solo el veredicto.
import fs from"node:fs";import path from"node:path";import{spawnSync}from"node:child_process";
const RAW=path.join("release/evidence/.vitest-report.json");
const LEDGER=path.join("release/evidence/test-ledger.json");
fs.mkdirSync(path.dirname(LEDGER),{recursive:true});
const r=spawnSync("pnpm",["-s","exec","vitest","run","--reporter=json",`--outputFile=${RAW}`],{encoding:"utf8",env:process.env});
if(!fs.existsSync(RAW)){
 console.error("vitest no produjo reporte JSON; el libro de ejecución no se puede construir.");
 console.error((r.stderr??"").trim().split("\n").slice(-10).join("\n"));
 process.exit(1);
}
type Assertion=Readonly<{status?:string}>;
type Suite=Readonly<{name?:string;status?:string;assertionResults?:Assertion[]}>;
const rep=JSON.parse(fs.readFileSync(RAW,"utf8")) as {testResults?:Suite[];numTotalTests?:number;numPassedTests?:number;numFailedTests?:number};
const raiz=process.cwd()+path.sep;
const archivos=(rep.testResults??[]).map(s=>{
 const abs=String(s.name??"");
 const rel=abs.startsWith(raiz)?abs.slice(raiz.length):abs;
 const casos=s.assertionResults??[];
 const fallidos=casos.filter(a=>a.status!=="passed"&&a.status!=="pending").length;
 return{file:rel.split(path.sep).join("/"),status:fallidos===0&&s.status!=="failed"?"PASS":"FAIL",tests:casos.length};
}).sort((a,b)=>a.file.localeCompare(b.file));
fs.writeFileSync(LEDGER,JSON.stringify({
 generatedAt:new Date().toISOString(),
 files:archivos.length,
 totalTests:rep.numTotalTests??archivos.reduce((n,a)=>n+a.tests,0),
 failedTests:rep.numFailedTests??archivos.filter(a=>a.status==="FAIL").length,
 results:archivos,
},null,2)+"\n");
fs.rmSync(RAW,{force:true}); // el reporte crudo de vitest no se versiona: el libro es el resumen verificable
const fallidos=archivos.filter(a=>a.status==="FAIL");
console.log(`LIBRO DE PRUEBAS: ${archivos.length} archivos · ${rep.numTotalTests??"?"} pruebas · ${fallidos.length} archivos en rojo`);
process.exit(fallidos.length?1:0);
