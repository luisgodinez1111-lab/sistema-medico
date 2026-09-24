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
//
// Y guarda el registro HERMANO (R06-F11, lote 12e): los paquetes duplicados que SIGUEN en disco y tienen que declarar cuál
// manda. Un documento que dice «la vigente es ésta» envejece en silencio —lo acaba de demostrar el drill de restauración,
// cuya expectativa escrita a mano llevaba un lote desalineada sin que nadie lo supiera—, así que cada afirmación del
// registro se comprueba contra el disco y contra los importadores reales.
type Retirada=Readonly<{path:string;lote:string;reason:string}>;
const registro=JSON.parse(fs.readFileSync("docs/adjudication/retired-paths.json","utf8")) as{purpose:string;retired:Retirada[]};
type Miembro=Readonly<{path:string;verdict:"VIGENTE"|"INVARIANTE"|"SIN_LLAMADOR";reason:string}>;
type Grupo=Readonly<{base:string;liveImplementation:string;note:string;members:readonly Miembro[]}>;
const duplicados=JSON.parse(fs.readFileSync("docs/adjudication/duplicate-authority.json","utf8")) as{purpose:string;verdicts:Record<string,string>;groups:Grupo[]};
/** Ficheros de código del repo, por raíz, para contar importadores de verdad. */
function codigo(raices:readonly string[]):string[]{
 const out:string[]=[];
 const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  if(e.name==="node_modules"||e.name===".next"||e.name===".git"||e.name.includes(" 2."))continue;
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);else if(/\.(ts|tsx|mts)$/.test(e.name))out.push(p);
 }};
 for(const r of raices)if(fs.existsSync(r))walk(r);
 return out;
}
/** Importadores de `packages/<nombre>/src`, separando producción de pruebas y del propio paquete. */
function importadores(pkg:string){
 const aguja=new RegExp(`packages/${pkg.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}/src(?:["'/]|$)`);
 const hits=codigo(["apps","packages","scripts","tests"]).filter(f=>!f.startsWith(`packages/${pkg}/`)&&aguja.test(fs.readFileSync(f,"utf8")));
 return{produccion:hits.filter(f=>!f.startsWith("tests/")),invariante:hits.filter(f=>f.startsWith(path.join("tests","traceability")))};
}

describe("rutas retiradas: no reaparecen (iCloud restaura lo borrado)",()=>{
 it("el registro está poblado y cada entrada dice lote y motivo",()=>{
  expect(registro.retired.length).toBeGreaterThanOrEqual(20);
  for(const r of registro.retired){
   expect(r.path,"toda entrada necesita ruta").toBeTruthy();
   expect(r.lote,`${r.path}: falta el lote`).toMatch(/^1[0-9][a-z]$/); // 10a…19z (el lote 12e añadió los primeros de la docena 12)
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

// Auditoría 2026-09-19, anexo R06 (R06-F11) — los duplicados que SOBREVIVEN declaran quién manda, y se comprueba.
describe("paquetes duplicados: la autoridad está declarada y es cierta",()=>{
 const enDisco=fs.readdirSync("packages",{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name);
 it("TODO grupo de hermanos versionados en packages/ está declarado en el registro",()=>{
  // Un hermano versionado es `x` junto a `x-v2`/`x-v4`…: la forma exacta que R06-F11 señaló. Si aparece uno nuevo sin
  // declararse, este test lo nombra: la decisión de cuál manda se toma al crearlo, no dos auditorías después.
  const grupos=new Map<string,string[]>();
  for(const p of enDisco){const base=p.replace(/-v\d+$/,"");if(base!==p&&enDisco.includes(base))grupos.set(base,[base,p]);}
  const declarados=new Set(duplicados.groups.map(g=>g.base));
  expect([...grupos.keys()].filter(b=>!declarados.has(b)),"grupos duplicados sin declaración de autoridad").toEqual([]);
 });
 it("cada miembro declarado existe, tiene motivo sustantivo y un veredicto del vocabulario",()=>{
  expect(duplicados.groups.length).toBeGreaterThanOrEqual(4);
  for(const g of duplicados.groups){
   expect(fs.existsSync(g.liveImplementation.split(" ")[0]!),`${g.base}: la implementación viva declarada no existe (${g.liveImplementation})`).toBe(true);
   expect(g.members.length,`${g.base}: un grupo de duplicados tiene al menos dos miembros`).toBeGreaterThanOrEqual(2);
   for(const m of g.members){
    expect(fs.existsSync(m.path),`${m.path}: declarado en el registro pero ausente del disco (¿retirado sin actualizarlo?)`).toBe(true);
    expect(Object.keys(duplicados.verdicts),`${m.path}: veredicto fuera del vocabulario`).toContain(m.verdict);
    expect(m.reason.length,`${m.path}: el motivo debe decir qué hace y por qué ese veredicto`).toBeGreaterThan(60);
   }
  }
 });
 it("el veredicto coincide con los importadores REALES (si alguien cablea un duplicado muerto, esto falla)",()=>{
  const desviaciones:string[]=[];
  for(const g of duplicados.groups)for(const m of g.members){
   const pkg=m.path.replace(/^packages\//,"");
   const{produccion,invariante}=importadores(pkg);
   if(m.verdict==="VIGENTE"&&!produccion.length)desviaciones.push(`${m.path}: declarado VIGENTE y NADIE lo importa en producción`);
   if(m.verdict==="INVARIANTE"&&(produccion.length||!invariante.length))desviaciones.push(`${m.path}: declarado INVARIANTE; producción=[${produccion.join(",")}] traceability=[${invariante.join(",")}]`);
   if(m.verdict==="SIN_LLAMADOR"&&produccion.length)desviaciones.push(`${m.path}: declarado SIN_LLAMADOR y lo importa producción: ${produccion.join(", ")} — decida si pasa a VIGENTE o si el import se retira`);
  }
  expect(desviaciones).toEqual([]);
 });
 it("las tablas duplicadas declaran su autoridad en el catálogo de la base (COMMENT ON TABLE)",()=>{
  // La mitad de tablas de R06-F11 no va en un JSON: va donde la lee quien abre la base. 0020 declaró cuatro, 0026 el
  // outbox y 0027 las cinco que faltaban (los dos «break glass», los dos recibos de consumidor y la proyección muerta).
  const sql=fs.readdirSync("db/migrations").filter(f=>/^\d{4}_.*\.sql$/.test(f)).map(f=>fs.readFileSync(path.join("db/migrations",f),"utf8")).join("\n");
  for(const t of["audit_ledger","idempotency_keys","release_evidence","projection_checkpoints","outbox","break_glass_events","break_glass_reviews","consumer_receipts","outbox_consumer_receipts","patient_state_projection"])
   expect(new RegExp(`COMMENT ON TABLE\\s+${t}\\s+IS`,"i").test(sql),`${t}: tabla duplicada o legada sin declaración de autoridad en el catálogo`).toBe(true);
 });
});
