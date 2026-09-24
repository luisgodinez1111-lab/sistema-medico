// Auditoría 2026-09-19, anexo R09 (R09-F02) — genera `docs/compliance/inventario-de-algoritmos.md` desde el CÓDIGO.
//
// `pnpm algorithms:inventory` reescribe el documento; `pnpm algorithms:inventory --check` falla si el fichero en disco no
// coincide con lo que el código produce, que es lo que impide que la ficha derive (el test lo llama con --check).
//
// Se genera en vez de escribirse porque en esta misma remediación una ficha escrita a mano derivó cuatro veces: la
// expectativa del drill, la ruta de los value sets, el «27 migraciones» del runbook y el testid `result-action`.
import fs from"node:fs";import path from"node:path";
import{ALGORITHM_SPECS,SPEC_BY_ID}from"../../packages/clinical-algorithm-specs/src";

const SALIDA="docs/compliance/inventario-de-algoritmos.md";
const check=process.argv.includes("--check");

/** Ids que el código emite en un recibo de cálculo: la lista real de algoritmos expuestos por una ruta. */
function idsConRecibo():Map<string,string[]>{
 const porId=new Map<string,string[]>();
 const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  if(e.name==="node_modules"||e.name===".next")continue;
  const p=path.join(d,e.name);
  if(e.isDirectory()){walk(p);continue;}
  if(!/\.tsx?$/.test(e.name))continue;
  const src=fs.readFileSync(p,"utf8");
  for(const m of src.matchAll(/calcReceipt\(\{id:"([^"]+)"/g)){
   const id=m[1]!;porId.set(id,[...(porId.get(id)??[]),p]);
  }
 }};
 walk("apps/web");
 return porId;
}

const conRecibo=idsConRecibo();
const tabla=(o:Readonly<Record<string,string>>)=>Object.entries(o).map(([k,v])=>`\`${k}\` en ${v}`).join("; ");
const cotas=(b:unknown)=>"`"+JSON.stringify(b)+"`";

const lineas:string[]=[];
lineas.push("# Inventario de algoritmos clínicos — fórmula, unidades, umbrales y fuente");
lineas.push("");
lineas.push("> **GENERADO desde el código.** No editar a mano: `pnpm algorithms:inventory` lo reescribe y");
lineas.push("> `tests/v22/algorithm-inventory.test.ts` falla si el fichero y el código no coinciden.");
lineas.push("> Autoridad: auditoría 2026-09-19, anexo R09 (R09-F02).");
lineas.push("");
lineas.push("Los umbrales de esta página no son una transcripción: `packages/clinical-algorithm-specs` **importa** las");
lineas.push("constantes de cada implementación, así que si un umbral cambia en el código, cambia aquí. No hay dos copias.");
lineas.push("");
lineas.push("**Esto no es validación clínica.** Dice qué calcula el código, con qué unidades, qué cotas rechaza y de qué");
lineas.push("fuente sale. Que la fórmula sea la correcta para la población atendida lo tiene que decir un médico: es una de");
lineas.push("las condiciones de admisión a producción de ADR-0300 que solo el dueño puede cerrar.");
lineas.push("");
for(const s of ALGORITHM_SPECS){
 const rutas=conRecibo.get(s.id)??[];
 lineas.push(`## ${s.name} — \`${s.id}\``);
 lineas.push("");
 lineas.push(`- **Fórmula:** ${s.formula}`);
 lineas.push(`- **Unidades esperadas:** ${tabla(s.units)}`);
 lineas.push(`- **Cotas y umbrales (importados del código):** ${cotas(s.bounds)}`);
 lineas.push(`- **Qué devuelve:** ${s.output}`);
 lineas.push(`- **Fuente primaria:** ${s.source}`);
 lineas.push(`- **Población en que se validó:** ${s.validatedIn}`);
 lineas.push(`- **Lo que NO hace:** ${s.limits}`);
 lineas.push(`- **Expuesto por:** ${rutas.length?rutas.map(r=>`\`${r}\``).join(", "):"**ninguna ruta emite recibo con este id**"}`);
 lineas.push("");
}
// Huecos: lo que el código calcula sin ficha, dicho en el propio documento en vez de quedar invisible.
const sinFicha=[...conRecibo.keys()].filter(id=>!(id in SPEC_BY_ID)).sort();
lineas.push("## Huecos declarados");
lineas.push("");
lineas.push(`Algoritmos con ficha: **${ALGORITHM_SPECS.length}**. Ids que el código emite en un recibo de cálculo: **${conRecibo.size}**.`);
lineas.push("");
if(sinFicha.length){
 lineas.push("Estos ids viajan en un recibo y **todavía no tienen ficha**; un médico no puede validarlos leyendo este documento:");
 lineas.push("");
 for(const id of sinFicha)lineas.push(`- \`${id}\` — expuesto por ${(conRecibo.get(id)??[]).map(r=>`\`${r}\``).join(", ")}`);
}else{
 lineas.push("Todo id que viaja en un recibo de cálculo tiene su ficha.");
}
lineas.push("");
lineas.push("Las calculadoras que **no** emiten recibo (IMC, conversiones de unidad, clasificadores de rango) quedan fuera de");
lineas.push("este inventario por ahora: su resultado no es una recomendación de conducta. Si alguna pasa a emitir recibo, el");
lineas.push("guardarraíl la reclamará aquí automáticamente.");
lineas.push("");

const texto=lineas.join("\n");
if(check){
 const actual=fs.existsSync(SALIDA)?fs.readFileSync(SALIDA,"utf8"):"";
 if(actual!==texto){
  console.error(`DESINCRONIZADO: ${SALIDA} no coincide con el código. Ejecute \`pnpm algorithms:inventory\`.`);
  process.exit(1);
 }
 console.log(`OK: ${SALIDA} coincide con el código (${ALGORITHM_SPECS.length} fichas, ${conRecibo.size} ids con recibo).`);
}else{
 fs.writeFileSync(SALIDA,texto);
 console.log(JSON.stringify({generado:SALIDA,fichas:ALGORITHM_SPECS.length,idsConRecibo:conRecibo.size,sinFicha}));
}
