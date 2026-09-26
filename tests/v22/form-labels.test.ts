import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Refactor UI/UX pro-max — a11y (WCAG 1.3.1 / 4.1.2, regla axe `label`/`select-name`): TODO control de formulario del
// workspace (input/select/textarea) debe tener un nombre accesible. En este sistema el patrón frecuente era un <div> visual
// como etiqueta —que NO se asocia al control—; axe lo marca como violación seria. El sweep de render solo ve los formularios
// RENDERIZADOS (los colapsados «Nuevo X» y los ocultos tras un skeleton no se probaban). Este test estático los cubre TODOS:
// escanea el código de las vistas y exige aria-label / aria-labelledby / <label htmlFor> en cada control con estado.
const DIR="apps/web/app/workspace/views";
/** Devuelve el texto del tag desde '<' hasta su '>' real, ignorando los '>' dentro de llaves JSX ({e=>…}). */
function fullTag(s:string,i:number):string{
 let depth=0;
 for(let j=i;j<s.length;j++){const c=s[j]!;if(c==="{")depth++;else if(c==="}")depth--;else if(c===">"&&depth===0)return s.slice(i,j+1);}
 return s.slice(i,i+400);
}
function vistas():string[]{
 const out:string[]=[];
 for(const e of fs.readdirSync(DIR))if(e.endsWith(".tsx"))out.push(path.join(DIR,e));
 return out.sort();
}
describe("nombre accesible en todos los controles de formulario (WCAG 1.3.1 / 4.1.2)",()=>{
 it("ningún input/select/textarea con estado carece de aria-label / label asociado",()=>{
  const sinNombre:string[]=[];
  for(const p of vistas()){
   const src=fs.readFileSync(p,"utf8");
   const labeledIds=new Set([...src.matchAll(/htmlFor=\{?`?([^}"`]+)/g)].map(m=>m[1]!));
   for(const m of src.matchAll(/<(input|select|textarea)\b/g)){
    const tag=fullTag(src,m.index!);
    // Un control REAL siempre lleva estado o interacción; un `<select>` pelado (p.ej. citado en un comentario) se ignora.
    if(!/\b(value=|onChange=|placeholder=|defaultValue=|checked=)/.test(tag))continue;
    if(/aria-label|aria-labelledby/.test(tag))continue;
    if(/type="(file|hidden|checkbox|radio)"/.test(tag))continue;
    const idm=tag.match(/\bid=\{?`?([^}"`\s]+)/);
    if(idm&&labeledIds.has(idm[1]!))continue;
    const key=tag.match(/value=\{([^}]+)\}/)?.[1]??tag.match(/placeholder="([^"]+)"/)?.[1]??tag.slice(0,40);
    sinNombre.push(`${path.basename(p)} → <${m[1]}> ${key}`);
   }
  }
  expect(sinNombre,"controles sin nombre accesible (aria-label / label htmlFor)").toEqual([]);
 });
});
