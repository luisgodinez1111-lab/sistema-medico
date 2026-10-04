import{describe,it,expect}from"vitest";
import fs from"node:fs";
// Tema OSCURO del workspace (variables CSS en RAIL_CSS). El tema CLARO lo validan los guards de hex existentes
// (workspace-accessibility / chip-contrast) porque sus valores por defecto = los hex de siempre. Al migrar los colores a
// `var(--c-*)`, esos escáneres dejan de ver los pares del tema oscuro, así que esta guarda los mide a mano: la paleta
// oscura declarada en `.mos-app[data-theme="dark"]{…}` debe cumplir AA (4.5:1) en los pares que de verdad se pintan.
const SRC=fs.readFileSync("apps/web/app/workspace/shared.tsx","utf8");
const AA=4.5;
function luminancia(hex:string):number{
 const m=/^#([0-9a-fA-F]{6})$/.exec(hex.trim());
 if(!m)throw new Error(`no es un hex de 6 dígitos: ${hex}`);
 const c=m[1]!;
 const ch=(i:number):number=>{const v=parseInt(c.slice(i,i+2),16)/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};
 return 0.2126*ch(0)+0.7152*ch(2)+0.0722*ch(4);
}
const contraste=(a:string,b:string):number=>{const x=luminancia(a),y=luminancia(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
/** Extrae el mapa de variables del bloque `.mos-app[data-theme="dark"]{…}` de RAIL_CSS. */
function darkVars():Record<string,string>{
 const i=SRC.indexOf('.mos-app[data-theme="dark"]{');
 expect(i,"no se encontró el bloque de variables del tema oscuro en RAIL_CSS").toBeGreaterThan(-1);
 const body=SRC.slice(i,SRC.indexOf("}",i));
 const vars:Record<string,string>={};
 for(const m of body.matchAll(/--(c-[a-z0-9-]+):(#[0-9A-Fa-f]{6})/g))vars[m[1]!]=m[2]!;
 return vars;
}
describe("contraste del tema oscuro del workspace (WCAG AA 4.5:1)",()=>{
 const v=darkVars();
 const need=(k:string):string=>{const x=v[k];expect(x,`falta la variable oscura --${k}`).toBeTruthy();return x!;};
 it("declara la paleta oscura completa",()=>{
  for(const k of ["c-ink","c-muted","c-surface","c-canvas","c-wash",
   "c-green-fg","c-amber-fg","c-blue-fg","c-purple-fg","c-red-fg",
   "c-green-bg","c-amber-bg","c-blue-bg","c-purple-bg","c-red-bg"])need(k);
 });
 it("texto primario y secundario legibles sobre lienzo y superficie",()=>{
  const ink=need("c-ink"),muted=need("c-muted"),canvas=need("c-canvas"),surface=need("c-surface"),wash=need("c-wash");
  for(const [t,f,bg] of [["ink","c-ink",canvas],["ink","c-ink",surface],["muted","c-muted",canvas],["muted","c-muted",surface],["muted","c-muted",wash]] as [string,string,string][]){
   const r=contraste(need(f),bg);
   expect(r,`${t} sobre ${bg} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
  }
  void ink;void muted;
 });
 it("cada chip (texto sobre su fondo pálido oscuro) cumple AA",()=>{
  for(const c of ["green","amber","blue","purple","red"]){
   const fg=need(`c-${c}-fg`),bg=need(`c-${c}-bg`);
   const r=contraste(fg,bg);
   expect(r,`chip ${c}: ${fg} sobre ${bg} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
  }
 });
});
