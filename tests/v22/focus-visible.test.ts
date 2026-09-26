import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Refactor UI/UX pro-max — a11y (WCAG 2.4.7 «Foco visible» + 2.1.1 «Teclado»): todo elemento interactivo debe ser
// alcanzable por teclado Y mostrar un indicador de foco visible. El shell define un aro `:focus-visible` global (para
// botones/enlaces/campos y los clicables custom con role=button/tabindex de act()), con un override de color en el sidebar
// oscuro para que el aro contraste sobre el navy. Este test fija esas invariantes para que no se pierdan en un refactor.
const SRC=fs.readFileSync(path.join("apps/web/app/workspace/shared.tsx"),"utf8");
function lum(hex:string):number{const c=hex.replace("#","");const ch=(i:number):number=>{const v=parseInt(c.slice(i,i+2),16)/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};return 0.2126*ch(0)+0.7152*ch(2)+0.0722*ch(4);}
function contrastRatio(a:string,b:string):number{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
describe("foco visible por teclado (WCAG 2.4.7 / 2.1.1)",()=>{
 it("existe un aro :focus-visible GLOBAL que cubre los clicables custom (role=button / tabindex)",()=>{
  const m=/\.mos-app :is\(([^)]*)\):focus-visible\{outline:([^}]*)\}/.exec(SRC);
  expect(m,"falta la regla :focus-visible global en RAIL_CSS").not.toBeNull();
  const sel=m![1]!;
  for(const t of["button","select","textarea","input",`[role="button"]`,"[tabindex]"])
   expect(sel,`el aro global debe cubrir ${t}`).toContain(t);
  expect(m![2]!,"el aro debe usar outline sólido").toMatch(/solid #([0-9A-Fa-f]{6})/);
 });
 it("los buscadores con outline:none inline reciben aro por box-shadow (que el inline no pisa)",()=>{
  expect(SRC,"falta el aro por box-shadow para campos con outline:none inline").toMatch(/\.mos-app input:focus-visible[^{]*\{box-shadow:0 0 0 3px/);
 });
 it("el sidebar oscuro tiene su propio color de aro (contraste sobre el navy)",()=>{
  expect(SRC).toMatch(/\.mos-side :is\([^)]*\):focus-visible\{outline-color:#([0-9A-Fa-f]{6})\}/);
 });
 it("el color del aro cumple ≥3:1 sobre su fondo (contenido claro y sidebar oscuro)",()=>{
  const ring=/\.mos-app :is\([^)]*\):focus-visible\{outline:2px solid (#[0-9A-Fa-f]{6})/.exec(SRC)![1]!;
  expect(contrastRatio(ring,"#ffffff"),"aro sobre blanco").toBeGreaterThanOrEqual(3);
  const sideRing=/\.mos-side :is\([^)]*\):focus-visible\{outline-color:(#[0-9A-Fa-f]{6})\}/.exec(SRC)![1]!;
  const navyLightest=/\.mos-side\{[^}]*?linear-gradient\(([^)]*)\)/.exec(SRC)![1]!.match(/#[0-9A-Fa-f]{6}/g)!
   .slice().sort((a,b)=>lum(b)-lum(a))[0]!;
  expect(contrastRatio(sideRing,navyLightest),"aro del sidebar sobre el navy").toBeGreaterThanOrEqual(3);
 });
 it("act() y actRow() hacen los clicables custom alcanzables por teclado (tabindex + Enter/Espacio)",()=>{
  const act=/export const act=[^\n]*/.exec(SRC)![0];
  const actRow=/export const actRow=[^\n]*/.exec(SRC)![0];
  for(const [name,code] of [["act",act],["actRow",actRow]] as const){
   expect(code,`${name} debe fijar tabIndex`).toMatch(/tabIndex:0/);
   expect(code,`${name} debe manejar teclado`).toMatch(/onKeyDown:keyAct/);
  }
  expect(act,"act debe declarar role=button para el clicable").toMatch(/role:"button"/);
 });
});
