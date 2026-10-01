import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
import{sectionId,SIDE_NAV,TOOLS_NAV,SECTION_EXP_TAB}from"../../apps/web/app/workspace/shared";
// Auditoría 2026-09-19, anexo R05a (WS1-15a) — la navegación entre ventanas del expediente, por ANCLA y comprobada.
//
// EL HALLAZGO: `scrollToSection` buscaba un `<h2>` por `textContent` exacto en TODO el documento. Dos fallos: al cambiar el
// texto de un título el botón dejaba de navegar EN SILENCIO, y un texto repetido en otra parte del DOM (sidebar, otra
// vista) mandaba el scroll al sitio equivocado.
//
// AL CABLEARLO APARECIÓ UNO YA ROTO: la ficha de Documentos navegaba a `scrollToSection("Documentos")` y el título del
// expediente es «Documentos clínicos». Nunca coincidieron, así que ese botón no hacía NADA —sin error, sin aviso— y nadie
// podía notarlo salvo usándolo. Éste es el test que lo habría cazado el primer día.
const UI="apps/web/app/workspace";
const EXP=path.join(UI,"views/exp.tsx");
function vistas():string[]{
 const out:string[]=[];
 const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);else if(e.name.endsWith(".tsx"))out.push(p);
 }};
 walk(UI);return out.sort();
}
/** Anclas declaradas en el expediente: `<h2 {...anchor("X")}>`. */
function anclas():string[]{
 const src=fs.readFileSync(EXP,"utf8");
 return [...src.matchAll(/anchor\("([^"]+)"\)/g)].map(m=>m[1]!);
}
// Los botones navegan con `scrollToSection("X")` o, desde el Patient 360 en sub-pestañas, con `goExpSection("X",…)`, que
// activa la sub-pestaña de X antes del scroll. Las dos formas son destinos: si el regex solo viera la primera, todo botón
// migrado a `goExpSection` saldría en silencio de la invariante de abajo.
const NAV_CALL=/(?:scrollToSection|goExpSection)\("([^"]*)"[,)]/g;
/** Destinos literales de `goExpSection` en las vistas. */
function destinosExp():string[]{
 const out=new Set<string>();
 for(const p of vistas())for(const m of fs.readFileSync(p,"utf8").matchAll(/goExpSection\("([^"]*)"[,)]/g))if(m[1])out.add(m[1]!);
 return [...out].sort();
}
/** Todo destino al que la aplicación navega: llamadas literales + los `h2` de la navegación + las pestañas del expediente. */
function destinos():string[]{
 const out=new Set<string>();
 for(const p of vistas()){
  const src=fs.readFileSync(p,"utf8");
  for(const m of src.matchAll(NAV_CALL))if(m[1])out.add(m[1]!);
 }
 for(const it of [...SIDE_NAV,...TOOLS_NAV])if(it.h2)out.add(it.h2);
 // Las pestañas del expediente declaran su destino en el propio array.
 const exp=fs.readFileSync(EXP,"utf8");
 const tabs=/const tabs:\[string,string\?\]\[\]=\[(.*?)\];/s.exec(exp)?.[1]??"";
 for(const m of tabs.matchAll(/,"([^"]+)"\]/g))out.add(m[1]!);
 return [...out].sort();
}

describe("navegación entre ventanas del expediente (WS1-15a)",()=>{
 it("TODO destino navegable tiene su ancla en el expediente",()=>{
  // La invariante que faltaba: un destino sin ancla es un botón que no hace nada, y no se nota hasta usarlo.
  const d=destinos(),a=new Set(anclas());
  expect(d.length,"no se encontraron destinos: ¿cambió la navegación?").toBeGreaterThanOrEqual(15);
  expect(d.filter(x=>!a.has(x)),"destino de navegación sin ancla en el expediente").toEqual([]);
 });
 it("el destino que estaba roto ahora existe con su nombre real",()=>{
  // «Documentos» contra un título que dice «Documentos clínicos»: el defecto concreto que encontró este hallazgo.
  const src=fs.readFileSync(path.join(UI,"views/documentos.tsx"),"utf8");
  expect(src,"la ficha de Documentos debe navegar al nombre real de la ventana").toMatch(/(?:scrollToSection|goExpSection)\("Documentos clínicos"[,)]/);
  expect(anclas()).toContain("Documentos clínicos");
 });
 it("todo destino de goExpSection tiene su sub-pestaña: si no, el scroll aterriza en una sección oculta",()=>{
  // `goExpSection` sin entrada en SECTION_EXP_TAB no activa ninguna sub-pestaña y vuelve el defecto que vino a corregir.
  const d=destinosExp();
  expect(d.length,"no se encontraron llamadas a goExpSection").toBeGreaterThan(0);
  expect(d.filter(x=>!(x in SECTION_EXP_TAB)),"destino sin sub-pestaña en SECTION_EXP_TAB").toEqual([]);
  // Y el propio mapa solo apunta a ventanas que existen.
  const a=new Set(anclas());
  expect(Object.keys(SECTION_EXP_TAB).filter(x=>!a.has(x)),"SECTION_EXP_TAB apunta a una ventana sin ancla").toEqual([]);
 });
 it("la navegación NO vuelve a buscar títulos por su texto en todo el DOM",()=>{
  const src=fs.readFileSync(path.join(UI,"shared.tsx"),"utf8");
  const fn=/export function scrollToSection[\s\S]*?\n\}/.exec(src)?.[0]??"";
  expect(fn,"debe resolver por id").toContain("getElementById");
  expect(fn,"y no recorrer los h2 del documento").not.toMatch(/querySelectorAll\("h2"\)/);
 });
 it("cada ancla usa el nombre que el propio título imprime",()=>{
  // El ancla y el título salen del mismo sitio; si alguien renombra el título sin renombrar el ancla, la navegación
  // seguiría funcionando pero el código mentiría sobre a dónde lleva.
  const src=fs.readFileSync(EXP,"utf8");
  const malos:string[]=[];
  for(const m of src.matchAll(/<h2 \{\.\.\.anchor\("([^"]+)"\)\}[^>]*>([^<{]+)/g))
   if(m[1]!.trim()!==m[2]!.trim())malos.push(`${m[1]} ≠ ${m[2]!.trim()}`);
  expect(malos,"ancla y título discrepan").toEqual([]);
 });
 it("los identificadores son estables y sin acentos (sirven como id de DOM)",()=>{
  expect(sectionId("Medicación")).toBe("mos-medicacion");
  expect(sectionId("Órdenes clínicas")).toBe("mos-ordenes-clinicas");
  expect(sectionId("Seguridad y auditoría")).toBe("mos-seguridad-y-auditoria");
  // Dos nombres distintos no pueden colapsar en el mismo id: el scroll iría a la ventana equivocada.
  const ids=anclas().map(sectionId);
  expect(new Set(ids).size,"dos ventanas comparten identificador").toBe(ids.length);
 });
});
