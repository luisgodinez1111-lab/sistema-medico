import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Refactor UI/UX pro-max — a11y (Ley WCAG): el sidebar oscuro (`.mos-side`) pinta su texto sobre un gradiente navy. Al
// agrupar la navegación por Ley de Hick se añadieron encabezados de sección (`.mos-navsec`) y ya existía `.mos-toolslbl`
// (HERRAMIENTAS); ambos usaban un gris-lila (#7C81BC) que daba 3.87:1 sobre el tono más claro del gradiente — por debajo del
// 4.5:1 que exige AA para texto normal (son 10px, no «texto grande»). Este test recalcula el contraste de CADA color de texto
// del sidebar contra el PEOR caso (la parada más clara del gradiente) y exige AA, para que el defecto no reaparezca en silencio.
const AA=4.5;const AA_LARGE=3;
const SRC=fs.readFileSync(path.join("apps/web/app/workspace/shared.tsx"),"utf8");
function lum(hex:string):number{const c=hex.replace("#","");const ch=(i:number):number=>{const v=parseInt(c.slice(i,i+2),16)/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};return 0.2126*ch(0)+0.7152*ch(2)+0.0722*ch(4);}
function contrastRatio(a:string,b:string):number{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
/** Color de la propiedad `color:#hex` dentro del bloque de una clase CSS en RAIL_CSS. */
function colorOf(cls:string):string{
 const re=new RegExp(cls.replace(/[.]/g,"\\.")+"\\{[^}]*?color:(#[0-9A-Fa-f]{6})","");
 const m=re.exec(SRC);
 if(!m)throw new Error(`no se encontró color en ${cls}`);
 return m[1]!;
}
describe("contraste del sidebar oscuro (refactor UI/UX — Ley de Hick + a11y)",()=>{
 // Parada más clara del gradiente de `.mos-side` = peor caso para texto claro sobre fondo oscuro.
 const grad=/\.mos-side\{[^}]*?background:linear-gradient\(([^)]*)\)/.exec(SRC)?.[1]??"";
 const stops=[...grad.matchAll(/#[0-9A-Fa-f]{6}/g)].map(m=>m[0]);
 const worst=stops.slice().sort((a,b)=>lum(b)-lum(a))[0]!; // el más claro
 it("el gradiente del sidebar se lee y tiene varias paradas",()=>{
  expect(stops.length,"no se hallaron las paradas del gradiente").toBeGreaterThanOrEqual(2);
 });
 it("los encabezados de sección y de herramientas cumplen AA (fue el defecto: #7C81BC = 3.87:1)",()=>{
  for(const cls of [".mos-navsec",".mos-toolslbl"]){
   const r=contrastRatio(colorOf(cls),worst);
   expect(r,`${cls} ${colorOf(cls)} sobre ${worst}`).toBeGreaterThanOrEqual(AA);
  }
 });
 it("cada texto normal del sidebar (nav, marca, rol del médico) cumple AA sobre el peor caso",()=>{
  const fallos:string[]=[];
  for(const cls of [".mos-navi",".mos-bsub",".mos-doc .rl",".mos-docmenu button"]){
   const c=colorOf(cls);const r=contrastRatio(c,worst);
   if(r<AA)fallos.push(`${cls} ${c} sobre ${worst}: ${r.toFixed(2)}:1`);
  }
  expect(fallos,"texto del sidebar por debajo de 4.5:1").toEqual([]);
 });
 it("el acento «OS» de la marca (texto grande) cumple al menos 3:1",()=>{
  const r=contrastRatio(colorOf(".mos-bname .os"),worst);
  expect(r).toBeGreaterThanOrEqual(AA_LARGE);
 });
});
