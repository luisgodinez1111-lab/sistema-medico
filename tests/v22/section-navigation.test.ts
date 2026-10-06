import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
import{sectionId,SIDE_NAV,TOOLS_NAV,SECTION_EXP_TAB,EXP_TABS,EXP_TAB_KEYS,EXP_TAB_LEGACY,EXP_TAB_SECTIONS}from"../../apps/web/app/workspace/shared";
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
/** Todo destino al que la aplicación navega: llamadas literales + los `h2` de la navegación + las pestañas del expediente. */
function destinos():string[]{
 const out=new Set<string>();
 for(const p of vistas()){
  const src=fs.readFileSync(p,"utf8");
  // Destinos literales: scrollToSection("X") y goExpSection("X",…) (éste activa la sub-pestaña correcta ANTES de hacer
  // scroll — la navegación del expediente tras el Lote B pasó a este helper; ambos cuentan como destino navegable).
  for(const m of src.matchAll(/(?:scrollToSection|goExpSection)\("([^"]*)"/g))if(m[1])out.add(m[1]!);
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
  // (Fase 2) Bajó el número de destinos al consolidar los módulos en el Expediente; la invariante que importa es la de
  // abajo: ningún destino navegable sin ancla.
  expect(d.length,"no se encontraron destinos: ¿cambió la navegación?").toBeGreaterThanOrEqual(10);
  expect(d.filter(x=>!a.has(x)),"destino de navegación sin ancla en el expediente").toEqual([]);
 });
 it("el destino Documentos del expediente existe con su nombre real y su submenú",()=>{
  // «Documentos» contra un título que dice «Documentos clínicos»: el defecto histórico. Hoy Documentos es un submenú del
  // expediente, con su nombre REAL conservado en la sección/ancla y mapeado a su sub-pestaña en SECTION_EXP_TAB.
  // (Tras la fusión Pacientes⟷Expediente la ficha-preview se retiró; el submenú se navega desde el propio expediente.)
  expect(anclas(),"la sección conserva su nombre real").toContain("Documentos clínicos");
  // Tras consolidar dieciséis pestañas en cinco (06-oct-2026), «Documentos clínicos» vive en la pestaña «Plan» —lo que
  // sigue: documentos, consentimiento, interconsultas, agenda y obligaciones—. Lo que este test protege es que el ancla
  // conserve su NOMBRE REAL y que su pestaña esté mapeada; cuál sea la pestaña es una decisión de arquitectura de
  // información, y el defecto histórico era el desajuste entre el enlace y el título, no el nombre del submenú.
  expect(SECTION_EXP_TAB["Documentos clínicos"],"su ancla cae en la pestaña que la contiene").toBe("plan");
  const exp=fs.readFileSync(EXP,"utf8");
  expect(exp,"la sección se MONTA según la pestaña, no se oculta con hidden").toContain('inTab("plan")');
  expect(exp,"ninguna sección queda oculta con hidden: se montan o no existen").not.toContain("hidden={!inTab(");
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

 // Auditoría clínica multiespecialidad (06-oct-2026) — CINCO PESTAÑAS, Y NINGUNA SECCIÓN OCULTA.
 //
 // EL HALLAZGO, en palabras del dueño: «hay muchas ventanas, con poco funcionamiento; todo está en menús dentro de
 // submenús». Era literal: dieciséis pestañas para treinta y cuatro secciones, ONCE de ellas con una sola sección dentro.
 // Ver problemas, alergias y medicación de un paciente costaba tres clics en tres ventanas, cuando un médico los lee
 // juntos o no los lee. Y «Hospital» tenía ocho secciones que con la bandera apagada —su estado normal— no mostraban
 // nada: una ventana vacía en el menú.
 it("son CINCO pestañas y cada una agrupa trabajo, no tipos de dato",()=>{
  expect(EXP_TABS.length,"si vuelven a crecer, alguien añadió una ventana en vez de una sección").toBe(5);
  expect(EXP_TAB_KEYS).toEqual(["resumen","encuentro","expediente","plan","admin"]);
  // Ninguna pestaña con UNA sola sección: eso era el defecto. «Consulta» es la excepción declarada —su única sección es
  // el encuentro entero, un formulario SOAP de cientos de líneas, no una lista.
  for(const t of EXP_TAB_KEYS){
   const n=EXP_TAB_SECTIONS[t].length;
   expect(n,`la pestaña ${t} no tiene secciones`).toBeGreaterThan(0);
   if(t!=="encuentro")expect(n,`la pestaña ${t} tiene una sola sección: es una ventana, no una agrupación`).toBeGreaterThan(1);
  }
  // Las treinta y cuatro secciones siguen existiendo: consolidar no es borrar.
  expect(Object.keys(SECTION_EXP_TAB).length).toBe(34);
  expect(EXP_TAB_KEYS.reduce((n,t)=>n+EXP_TAB_SECTIONS[t].length,0)).toBe(34);
 });
 it("ninguna sección se oculta con `hidden`: se monta o no existe",()=>{
  const exp=fs.readFileSync(EXP,"utf8");
  // `hidden` dejaba las treinta y cuatro secciones en el DOM a la vez: una búsqueda del navegador encontraba el mismo
  // dato dos veces y un lector de pantalla recorría secciones que el médico no está viendo.
  expect(exp,"vuelve el `hidden`: la sección de otra pestaña no debe existir en el DOM").not.toContain("hidden={!inTab(");
  const montajes=(exp.match(/\{inTab\("[a-z]+"\)&&/g)??[]).length;
  expect(montajes,"cada sección se monta con su condición de pestaña").toBeGreaterThanOrEqual(34);
 });
 it("los enlaces guardados a las dieciséis pestañas viejas siguen llevando a donde está el dato",()=>{
  // Un enlace que no falla pero tampoco lleva a ninguna parte es peor que uno roto: el médico cree que llegó.
  for(const[viejo,nuevo] of Object.entries(EXP_TAB_LEGACY)){
   expect(EXP_TAB_KEYS,`${viejo} apunta a una pestaña que no existe`).toContain(nuevo);
   expect(EXP_TAB_KEYS,`${viejo} sigue siendo una pestaña: el mapa de legado sobra`).not.toContain(viejo);
  }
  // Las once pestañas retiradas están TODAS en el mapa: si alguien retira otra sin añadirla aquí, su enlace muere.
  for(const viejo of ["historia","problemas","alergias","medicacion","signos","resultados","ordenes","vacunas","hospital","documentos","coordinacion","intel"])
   expect(EXP_TAB_LEGACY[viejo],`${viejo} no tiene destino: su enlace quedaría en la pestaña por omisión`).toBeDefined();
 });
});
