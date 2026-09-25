import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
import{primitive}from"../../packages/design-system/src";
// Auditoría 2026-09-19, anexo R05b (R05b-27, R05b-08, R05b-09, R05b-10, R05b-28) — accesibilidad del espacio de trabajo.
//
// R05b-27 venía con los números calculados por el auditor y los reproduje con la misma fórmula (luminancia relativa WCAG
// 2.x) antes de tocar nada: el gris de los encabezados de TODAS las tablas (#9AA0BC) daba 2.58:1 sobre blanco, el verde de
// los chips «Completada/Normal/Aplicada» 2.80:1 sobre su fondo, el ámbar 3.22:1, el azul 4.48:1 y el púrpura 4.37:1. Cuatro
// de los seis pares más usados incumplían el mínimo AA de 4.5:1.
//
// R05b-08 era la causa: el espacio de trabajo no usaba los tokens del design system —que ya se habían corregido en el
// K-09— sino hexes sueltos con otro tono (#16A66A, #B7791F, #6C5CF6, #F0455E, #9AA0BC). Al sustituirlos por tokens se
// cierran los dos hallazgos a la vez, y los tokens nuevos llevan su contraste medido en el propio paquete.
const UI="apps/web/app/workspace";
const AA=4.5;
function luminancia(hex:string):number{
 const m=/^#([0-9a-fA-F]{6})$/.exec(hex.trim());
 if(!m)throw new Error(`no es un hex de 6 dígitos: ${hex}`);
 const c=m[1]!;
 const ch=(i:number):number=>{const v=parseInt(c.slice(i,i+2),16)/255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};
 return 0.2126*ch(0)+0.7152*ch(2)+0.0722*ch(4);
}
const contraste=(a:string,b:string):number=>{const x=luminancia(a),y=luminancia(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
function archivos():string[]{
 const out:string[]=[];
 const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);else if(e.name.endsWith(".tsx"))out.push(p);
 }};
 walk(UI);return out.sort();
}
/** Los hexes exactos que el auditor contó y midió como incumplidores. */
const HEXES_DEL_HALLAZGO=["#16A66A","#B7791F","#6C5CF6","#F0455E","#9AA0BC","#E5983B"];

describe("contraste del espacio de trabajo (R05b-27 / R05b-08)",()=>{
 it("los hexes de marca que medían por debajo de AA ya no se usan como color de texto",()=>{
  const ofensas:string[]=[];
  for(const f of archivos()){
   // Solo líneas de CÓDIGO: los comentarios de esta corrección citan los hexes del defecto.
   const src=fs.readFileSync(f,"utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
   for(const h of HEXES_DEL_HALLAZGO){
    for(const m of src.matchAll(new RegExp(`color:"?\\$?\\{?${h}`,"gi")))ofensas.push(`${f}: ${m[0]}`);
   }
  }
  expect(ofensas,"hex de marca por debajo de AA usado como color de texto").toEqual([]);
 });
 it("y la razón por la que no se usan: medidos con la fórmula, fallan",()=>{
  // Se deja la medición en el test para que nadie los reintroduzca «porque se ven bien».
  expect(contraste("#9AA0BC","#FFFFFF")).toBeLessThan(3);      // encabezados de tabla: 2.58:1
  expect(contraste("#16A66A",primitive.color.greenPale)).toBeLessThan(3);  // chip verde: 2.80:1
  expect(contraste("#B7791F",primitive.color.amberPale)).toBeLessThan(AA); // chip ámbar: 3.22:1
  expect(contraste("#6C5CF6",primitive.color.purplePale)).toBeLessThan(AA);// púrpura suelto: 3.99:1
 });
 it("los tokens que los sustituyen SÍ cumplen sobre el fondo en el que se pintan",()=>{
  const pares:[string,string][]=[
   [primitive.color.greenOnPale,primitive.color.greenPale],
   [primitive.color.amberOnPale,primitive.color.amberPale],
   [primitive.color.blueOnPale,primitive.color.bluePale],
   [primitive.color.purpleOnPale,primitive.color.purplePale],
   [primitive.color.redOnPale,primitive.color.redPale],
   [primitive.color.muted,primitive.color.white],
  ];
  for(const[fg,bg]of pares)expect(contraste(fg,bg),`${fg} sobre ${bg}`).toBeGreaterThanOrEqual(AA);
 });
 it("ningún color de texto declarado en el espacio de trabajo cae por debajo de 3:1 sobre blanco",()=>{
  // Umbral deliberadamente más laxo que AA: aquí no se conoce el fondo real de cada uso (hay paneles oscuros y estados
  // deshabilitados, que WCAG exceptúa). Por debajo de 3:1 sobre blanco no hay fondo claro en el que ese texto se lea.
  const ofensas:string[]=[];
  for(const f of archivos()){
   const src=fs.readFileSync(f,"utf8");
   for(const m of src.matchAll(/color:"(#[0-9A-Fa-f]{6})"/g)){
    const c=m[1]!;
    // Se excluyen los claros: son texto sobre los paneles oscuros del sidebar y del hero.
    if(luminancia(c)>0.4)continue;
    if(contraste(c,"#FFFFFF")<3)ofensas.push(`${path.basename(f)}: ${c} (${contraste(c,"#FFFFFF").toFixed(2)}:1)`);
   }
  }
  expect(ofensas,"color de texto ilegible sobre fondo claro").toEqual([]);
 });
});

describe("controles y etiquetas (R05b-09 / R05b-10 / R05b-28)",()=>{
 it("no queda ningún `<label onClick>` haciendo de casilla",()=>{
  // Un `<label>` sin control asociado no recibe foco, no se activa con teclado y se anuncia como texto suelto: sin rol,
  // sin nombre y sin estado marcado. Eran siete, en cinco vistas.
  const ofensas:string[]=[];
  for(const f of archivos()){
   const src=fs.readFileSync(f,"utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
   for(const m of src.matchAll(/<label[^>]*onClick/g))ofensas.push(`${path.basename(f)}: ${m[0]}`);
  }
  expect(ofensas,"casilla falsa: `<label onClick>` sin input").toEqual([]);
 });
 it("la casilla compartida es un input real, enfocable y con estado anunciado",()=>{
  const src=fs.readFileSync(path.join(UI,"shared.tsx"),"utf8");
  const i=src.indexOf("export function Check(");
  expect(i,"falta la casilla compartida").toBeGreaterThan(-1);
  const fn=src.slice(i,i+1400);
  expect(fn,"tiene que ser un checkbox de verdad").toContain('type="checkbox"');
  expect(fn,"su estado lo lleva el input, no un span dibujado").toMatch(/checked=\{checked\}/);
  expect(fn,"la caja visual es decorativa para el lector de pantalla").toContain('aria-hidden="true"');
  // El input es transparente pero existe: el anillo de foco se pinta sobre la caja visual.
  expect(src,"falta el foco visible de la casilla").toContain(".mos-check input:focus-visible+span");
 });
 it("toda etiqueta de formulario está asociada a su control",()=>{
  // `<label>texto</label><input>` sin `htmlFor`/`id` deja el campo sin nombre accesible: el lector anuncia «campo de
  // edición» y nada más, o solo el placeholder, que desaparece al escribir.
  const ofensas:string[]=[];
  for(const f of archivos()){
   const src=fs.readFileSync(f,"utf8");
   for(const m of src.matchAll(/<label(?![^>]*htmlFor)[^>]*>([^<]{1,60})<\/label>\s*<input(?![^>]*aria-label)/g))
    ofensas.push(`${path.basename(f)}: «${m[1]!.trim()}»`);
  }
  expect(ofensas,"etiqueta sin asociar a su input (ni htmlFor ni aria-label)").toEqual([]);
 });
 it("los helpers de casilla ya no se redefinen en cada vista",()=>{
  // R05b-28: el mismo cuerpo repetido en cinco vistas, reconstruido en cada render. Ahora hay uno.
  let definiciones=0;
  for(const f of archivos()){
   const src=fs.readFileSync(f,"utf8");
   definiciones+=(src.match(/const chk2?=\(on:boolean,l:string,tog:\(\)=>void\)=><label/g)??[]).length;
  }
  expect(definiciones,"vuelve a haber casillas dibujadas a mano por vista").toBe(0);
 });
});
