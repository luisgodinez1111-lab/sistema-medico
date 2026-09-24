import{describe,it,expect}from"vitest";
import fs from "node:fs";
import path from "node:path";
// Guardián de lo RETIRADO. Este repositorio vive en una carpeta sincronizada por iCloud Drive (`~/Documents` con
// «Escritorio y Documentos» activado es el proveedor de CloudDocs, aunque parezca una carpeta normal), y iCloud
// RESTAURA lo borrado: tras los lotes 10w y 10y los ocho paquetes retirados reaparecieron en disco, y el typecheck
// volvió a compilarlos. Un fichero muerto que vuelve no es inocuo: si además lleva tests, devuelve cobertura aparente
// sobre código que nadie ejecuta — exactamente el hallazgo que la auditoría persigue.
//
// Este test convierte ese riesgo en un fallo visible: si una ruta retirada reaparece, `pnpm test` falla y dice por qué
// se retiró. También exige que cada retiro esté JUSTIFICADO, para que la lista no se convierta en un cajón.
type Retirada=Readonly<{path:string;lote:string;reason:string}>;
const registro=JSON.parse(fs.readFileSync("docs/adjudication/retired-paths.json","utf8")) as{purpose:string;retired:Retirada[]};

describe("rutas retiradas: no reaparecen (iCloud restaura lo borrado)",()=>{
 it("el registro está poblado y cada entrada dice lote y motivo",()=>{
  expect(registro.retired.length).toBeGreaterThanOrEqual(20);
  for(const r of registro.retired){
   expect(r.path,"toda entrada necesita ruta").toBeTruthy();
   expect(r.lote,`${r.path}: falta el lote`).toMatch(/^10[a-z]$/);
   expect(r.reason.length,`${r.path}: el motivo debe explicar por qué se retiró`).toBeGreaterThan(40);
  }
 });
 it("ninguna ruta retirada existe en el disco",()=>{
  const reaparecidas=registro.retired.filter(r=>fs.existsSync(r.path));
  expect(reaparecidas.map(r=>`${r.path} (retirada en ${r.lote}: ${r.reason.slice(0,80)}…)`),
   "si esto falla, iCloud (o un editor) restauró ficheros retirados: bórralos del disco, no solo de git").toEqual([]);
 });
 it("ninguna ruta retirada volvió al índice de git",()=>{
  // Comprobación por el índice, no por el árbol de trabajo: detecta un `git add` accidental de lo restaurado.
  const indice=new Set(fs.readFileSync(".git/index").toString("binary").split("\0").join("\n").split("\n"));
  const enIndice=registro.retired.filter(r=>[...indice].some(e=>e.startsWith(r.path)));
  expect(enIndice.map(r=>r.path),"lo retirado no puede volver al índice").toEqual([]);
 });
 it("nadie importa una ruta retirada (un import a código muerto no compila, pero avisa antes)",()=>{
  const sospechosos:string[]=[];
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   if(e.name==="node_modules"||e.name===".next"||e.name===".git"||e.name.includes(" 2."))continue;
   const p=path.join(d,e.name);
   if(e.isDirectory())walk(p);
   else if(/\.(ts|tsx|mts|mjs)$/.test(e.name)&&p!=="tests/v22/retired-paths.test.ts"){
    const src=fs.readFileSync(p,"utf8");
    for(const r of registro.retired){
     if(!r.path.startsWith("packages/")&&!r.path.startsWith("apps/"))continue;
     const modulo=r.path.replace(/\.tsx?$/,"").replace(/^packages\//,"");
     // El nombre del módulo retirado puede ser PREFIJO de uno vivo (`rate-limit` frente a `rate-limit-v2`): el patrón
     // exige que la ruta termine exactamente ahí, con `/src` opcional y nada más.
     if(new RegExp(`from"[^"]*${modulo.replace(/[/\\]/g,"[/\\\\]")}(?:/src)?"$`,"m").test(src.replace(/from"([^"]*)"/g,(m)=>m)))sospechosos.push(`${p} → ${r.path}`);
    }
   }}};
  for(const raiz of ["apps","packages","scripts","tests","release"])if(fs.existsSync(raiz))walk(raiz);
  expect(sospechosos).toEqual([]);
 });
 it("los duplicados de conflicto de iCloud («fichero 2.ext») no entran en el repositorio",()=>{
  // iCloud resuelve un conflicto creando «nombre 2.ext». Quince de ellos llegaron a entrar en git antes de la auditoría.
  const duplicados:string[]=[];
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   if(e.name==="node_modules"||e.name===".next"||e.name===".git")continue;
   const p=path.join(d,e.name);
   if(e.name.includes(" 2."))duplicados.push(p);
   else if(e.isDirectory())walk(p);
  }};
  for(const raiz of ["apps","packages","scripts","tests","db","docs","safety","capabilities","release"])if(fs.existsSync(raiz))walk(raiz);
  expect(duplicados,"duplicados de iCloud en el árbol: bórralos (y considera mover el repo fuera de ~/Documents)").toEqual([]);
 });
 it("el .gitignore impide que un duplicado de conflicto se confirme por descuido",()=>{
  expect(fs.readFileSync(".gitignore","utf8")).toMatch(/^\* 2\.\*$/m);
 });
});
