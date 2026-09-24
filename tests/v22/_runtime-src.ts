import fs from "node:fs";
import path from "node:path";
// Auxiliar de pruebas: el runtime clínico dejó de ser un fichero (auditoría R01-001) y ahora son la fachada
// `apps/web/lib/clinical-runtime.ts` más los módulos por dominio de `apps/web/lib/runtime/`. Los guardianes que
// inspeccionan el CÓDIGO deben mirar los dominios, no un fichero concreto, para no volver a acoplarse a la forma.
const RUNTIME_DIR="apps/web/lib/runtime";
export const runtimeFiles=():string[]=>[
 "apps/web/lib/clinical-runtime.ts",
 ...fs.readdirSync(RUNTIME_DIR).filter(f=>f.endsWith(".ts")).map(f=>path.join(RUNTIME_DIR,f)),
];
/** Todo el código del runtime clínico concatenado (para buscar patrones que no deben existir en ningún dominio). */
export const runtimeSource=():string=>runtimeFiles().map(f=>fs.readFileSync(f,"utf8")).join("\n");
/** Cuerpo de una función exportada del runtime, en el dominio donde viva. */
export function runtimeBlock(nombre:string):string{
 for(const f of runtimeFiles()){
  const src=fs.readFileSync(f,"utf8");
  const i=src.indexOf(`export async function ${nombre}(`);
  if(i<0)continue;
  const j=src.indexOf("\n}",i);
  return src.slice(i,j<0?undefined:j);
 }
 throw new Error(`no existe la función ${nombre} en el runtime clínico`);
}
