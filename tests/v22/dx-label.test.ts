import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{DX_LABEL}from"../../apps/web/app/workspace/shared";
import{lookupIcd10,searchIcd10,catalogSize}from"../../packages/terminology/src";
// Auditoría 2026-09-19, anexo R05a (R05a-F03) — etiqueta de diagnóstico: cobertura y fallback honesto.
//
// EL HALLAZGO. `DX_LABEL` mapeaba ~19 prefijos CIE-10 a abreviaturas clínicas («E11» → «DM2») y, si no encontraba nada,
// devolvía el CÓDIGO CRUDO. En un chip de diagnóstico un código se lee como si fuera el nombre del diagnóstico: quien mira
// la pantalla no puede saber si el sistema no conoce ese código o si el diagnóstico se llama «K21.9».
//
// LA CORRECCIÓN, sin inventar contenido clínico: antes de rendirse se consulta el catálogo CIE-10 que el repositorio YA
// tiene (`packages/terminology`, el mismo que valida al codificar un problema y que ata la descripción canónica al evento).
// Y si el código no está catalogado, se muestra MARCADO como código —«CIE-10 K21.9»— en vez de disfrazado de nombre.

describe("etiqueta de diagnóstico desde el código CIE-10 (R05a-F03)",()=>{
 it("los estadios de ERC coinciden con la CIE-10 y con el catálogo del propio repositorio",()=>{
  // CORRECCIÓN CLÍNICA hallada al cablear este hallazgo: el mapa estaba DESPLAZADO UN ESTADIO. N18.5 (eGFR < 15) se
  // mostraba como «ERC G4» (eGFR 15–29) y N18.6 —terminal, en diálisis— como «ERC G5». El estadio gobierna dosificación,
  // urgencia de referencia y evitación de contraste, así que un estadio menos en el chip cambia la conducta.
  expect(DX_LABEL("N18.3")).toBe("ERC G3");
  expect(DX_LABEL("N18.4")).toBe("ERC G4");
  expect(DX_LABEL("N18.5")).toBe("ERC G5");
  expect(DX_LABEL("N18.6")).toMatch(/terminal|diálisis/);
  // No se afirma la subdivisión a/b: exige N18.31 o N18.32; con N18.3 a secas sería precisión inventada.
  expect(DX_LABEL("N18.3")).not.toMatch(/G3a|G3b/);
  // Y la UI no puede volver a contradecir al catálogo del repositorio sobre el mismo código.
  expect(lookupIcd10("N18.5")!.description).toMatch(/estadio 5/i);
  expect(lookupIcd10("N18.6")!.description).toMatch(/terminal/i);
 });
 it("las abreviaturas clínicas siguen ganando: en un chip, «DM2» es mejor que la frase completa",()=>{
  expect(DX_LABEL("E11.9")).toBe("DM2");
  expect(DX_LABEL("I10")).toBe("HTA");
  // Y el estadio más específico gana al genérico: N18.4 no puede caer en «ERC».
  expect(DX_LABEL("N18.4")).not.toBe("ERC");
 });
 it("un código catalogado SIN abreviatura muestra su descripción canónica, no el código",()=>{
  // Éste era el defecto: un código catalogado pero SIN abreviatura se pintaba como el código a secas en un chip de
  // diagnóstico. Se busca uno así en el propio catálogo en vez de fijar un código a mano: la lista crece.
  // Se BUSCAN candidatos por categoría en vez de fijar uno a mano: las abreviaturas crecen y un código elegido hoy puede
  // tener abreviatura mañana. (searchIcd10 exige una consulta y acota a 20, así que se recorren categorías.)
  const candidatos=["J18","A09","B34","O80","R07","D50"].flatMap(p=>searchIcd10(p).filter(x=>x.code.startsWith(p)));
  const sinAbreviatura=candidatos.map(x=>({c:x.code,cat:lookupIcd10(x.code)}))
   .find(x=>x.cat&&DX_LABEL(x.c)===x.cat.description);
  expect(sinAbreviatura,"debe haber al menos un código catalogado que caiga en la descripción canónica").toBeTruthy();
  expect(DX_LABEL(sinAbreviatura!.c)).not.toBe(sinAbreviatura!.c);
 });
 it("un código NO catalogado se muestra marcado como código, nunca disfrazado de diagnóstico",()=>{
  expect(lookupIcd10("Z99.9"),"si algún día se cataloga, este caso hay que cambiarlo").toBeUndefined();
  expect(DX_LABEL("Z99.9")).toBe("CIE-10 Z99.9");
  // La invariante que importa: el resultado nunca es el código a secas.
  for(const c of ["Z99.9","F41.1","Q99.9"])expect(DX_LABEL(c)).not.toBe(c.toUpperCase());
 });
 it("normaliza como el resto del sistema (espacios y minúsculas)",()=>{
  expect(DX_LABEL(" e11.9 ")).toBe("DM2");
  expect(DX_LABEL("i10")).toBe("HTA");
 });
 it("toda abreviatura declarada corresponde a un código que el catálogo reconoce",()=>{
  // Ata las abreviaturas a una fuente: una abreviatura para un prefijo que el catálogo no conoce sería contenido clínico
  // inventado en la capa de presentación, que es el patrón que esta auditoría persigue.
  const src=fs.readFileSync("apps/web/app/workspace/shared.tsx","utf8");
  const bloque=/const m:\[string,string\]\[\]=\[(.*?)\];/s.exec(src)?.[1]??"";
  const prefijos=[...bloque.matchAll(/\["([A-Z]\d{2}(?:\.\d+)?)","[^"]+"\]/g)].map(x=>x[1]!);
  expect(prefijos.length,"no se encontraron abreviaturas").toBeGreaterThanOrEqual(15);
  // Un prefijo vale si el catálogo tiene ese código exacto o CUALQUIER código que empiece igual: «N18» y «E78» son
  // categorías de la CIE-10 y el catálogo guarda las hojas (N18.3, E78.5), que es lo correcto.
  const huerfanos=prefijos.filter(p=>!lookupIcd10(p)&&!searchIcd10(p).some(x=>x.code.startsWith(p)));
  expect(huerfanos,"abreviatura de un código que el catálogo no reconoce").toEqual([]);
  expect(catalogSize()).toBeGreaterThanOrEqual(80);
 });
});
