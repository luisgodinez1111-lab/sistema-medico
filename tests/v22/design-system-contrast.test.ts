import{describe,it,expect}from"vitest";
import{primitive as runtime,semantic,TONE,buttonStyle}from"../../packages/design-system/src";
import{primitive as contract}from"../../docs/design-contract/design/tokens";
// Auditoría 2026-09-19 (K-09): 4 de los 14 pares texto/fondo de los tokens incumplían WCAG AA. Este test recalcula el
// contraste (WCAG 2.x, luminancia relativa sRGB) de los 7 colores cromáticos sobre blanco y sobre el lienzo (14 pares),
// de los pares de cada tono de los componentes y de los botones, y exige ≥ 4.5:1. También fija que el paquete y el
// contrato de diseño declaran exactamente los mismos tokens (sin deriva entre ambos).
const AA=4.5;
function luminance(hex:string):number{
 const m=/^#([0-9a-f]{6})$/i.exec(hex.trim());
 if(!m)throw new Error(`color no hexadecimal de 6 dígitos: ${hex}`);
 const c=m[1]!;
 const ch=(i:number):number=>{const v=parseInt(c.slice(i,i+2),16)/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};
 return 0.2126*ch(0)+0.7152*ch(2)+0.0722*ch(4);
}
export function contrastRatio(a:string,b:string):number{
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
const CHROMATIC=["navy","blue","purple","cyan","green","amber","red"] as const;
describe("design system — contraste WCAG AA (K-09)",()=>{
 it("los 14 pares (7 colores × blanco y lienzo) alcanzan 4.5:1",()=>{
  const failures:string[]=[];
  for(const k of CHROMATIC)for(const bg of [runtime.color.white,runtime.color.canvas]){
   const r=contrastRatio(runtime.color[k],bg);
   if(r<AA)failures.push(`${k} ${runtime.color[k]} sobre ${bg}: ${r.toFixed(2)}:1`);
  }
  expect(failures).toEqual([]);
 });
 it("los valores corregidos siguen siendo los mínimos oscuros del tono (no se «apagó» la paleta de más)",()=>{
  // Cada color corregido cumple AA con margen pequeño: entre 4.5 y 6.0 sobre blanco.
  for(const k of ["cyan","green","amber"] as const){const r=contrastRatio(runtime.color[k],runtime.color.white);expect(r).toBeGreaterThanOrEqual(AA);expect(r).toBeLessThan(6);}
 });
 it("texto y fondo de cada tono de los componentes cumplen AA",()=>{
  for(const [tone,c] of Object.entries(TONE)){const r=contrastRatio(c.fg,c.bg);expect(r,`tono ${tone}`).toBeGreaterThanOrEqual(AA);}
 });
 it("texto de cada variante de botón sobre su fondo cumple AA",()=>{
  for(const [variant,st] of Object.entries(buttonStyle)){
   const bg=st.background==="transparent"?runtime.color.white:String(st.background);
   const r=contrastRatio(String(st.color),bg);
   expect(r,`botón ${variant}`).toBeGreaterThanOrEqual(AA);
  }
 });
 it("texto secundario (muted) sobre blanco y lienzo cumple AA",()=>{
  expect(contrastRatio(semantic.text.muted,semantic.surface.raised)).toBeGreaterThanOrEqual(AA);
  expect(contrastRatio(semantic.text.muted,semantic.surface.canvas)).toBeGreaterThanOrEqual(AA);
 });
 it("el paquete y el contrato de diseño declaran exactamente los mismos tokens primitivos",()=>{
  expect(runtime).toEqual(contract);
 });
});
