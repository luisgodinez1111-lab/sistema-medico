import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Refactor UI/UX pro-max — a11y (WCAG 1.4.3): los chips de estado/categoría del workspace pintan su TEXTO sobre un fondo
// pálido PROPIO, declarado inline como par `["#fondo","#texto"]`. Ahí los tokens generales no aplican, y dos pares fallaban
// AA (gris #6B7391 4.11:1, naranja #C2410C 4.42:1). Este test recalcula el contraste de CADA par de chip con hex crudo en
// las vistas y exige ≥ 4.5:1, para que ningún chip nuevo nazca ilegible.
const DIR="apps/web/app/workspace/views";
function lum(h:string):number{const c=h.replace("#","");const ch=(i:number):number=>{const v=parseInt(c.slice(i,i+2),16)/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};return 0.2126*ch(0)+0.7152*ch(2)+0.0722*ch(4);}
function cr(a:string,b:string):number{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
describe("contraste de los chips de estado/categoría (WCAG 1.4.3)",()=>{
 it("todo par [fondo, texto] con hex crudo alcanza 4.5:1",()=>{
  const fallos:string[]=[];let pares=0;
  for(const e of fs.readdirSync(DIR)){
   if(!e.endsWith(".tsx"))continue;
   const src=fs.readFileSync(path.join(DIR,e),"utf8");
   for(const m of src.matchAll(/\["(#[0-9A-Fa-f]{6})","(#[0-9A-Fa-f]{6})"\]/g)){
    pares++;
    const bg=m[1]!,fg=m[2]!;const r=cr(fg,bg);
    if(r<4.5)fallos.push(`${e}: texto ${fg} sobre ${bg} = ${r.toFixed(2)}:1`);
   }
  }
  expect(pares,"no se hallaron pares de chip: ¿cambió el formato?").toBeGreaterThan(0);
  expect(fallos,"chips con texto por debajo de AA 4.5:1").toEqual([]);
 });
});
