import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
import{conForma,FORMA,avisoDeZona,zonaDelNavegador}from"../../apps/web/app/workspace/shared";
// Auditoría 2026-09-19, anexo R05b (R05b-25, R05b-30, R05b-18, R05b-22, R05b-16) — robustez de la presentación.
//
// El hilo de este lote: lo que la pantalla hace cuando el dato NO es lo que esperaba. Cinco formas del mismo problema —una
// respuesta con otra forma, un clic que llega mientras se guarda, una lista recortada, un número que no es número y una hora
// sin reloj declarado— y en las cinco la pantalla seguía como si nada.
const UI="apps/web/app/workspace";
const vista=(f:string)=>fs.readFileSync(path.join(UI,"views",f),"utf8");
const modelo=()=>fs.readFileSync(path.join(UI,"model.tsx"),"utf8");

describe("una respuesta de red no es un tipo porque lo diga un `as` (R05b-25)",()=>{
 it("los snapshots clínicos comprueban su forma antes de entrar al estado",()=>{
  const src=modelo();
  for(const t of ["Snap","Trends","VitalHistory","CarePlanSnap","RefContext","FollowUpSnap","CiSnap","ConsTabs","DocsSnap"])
   expect(src.includes(`as unknown as ${t}`),`${t} sigue entrando al estado con un cast ciego`).toBe(false);
  expect((src.match(/conForma</g)??[]).length,"deben quedar las comprobaciones de forma").toBeGreaterThanOrEqual(11);
 });
 it("una respuesta con otra forma se trata como «no cargó», no se pinta a medias",()=>{
  expect(conForma<{a:number}>({a:1},["a"])).toEqual({a:1});
  expect(conForma({a:1},["a","b"]),"falta una clave que la vista va a indexar").toBeNull();
  expect(conForma({a:null},["a"]),"una clave nula no cumple la forma").toBeNull();
  // Un error del servidor tiene forma de error, no de snapshot: no puede colarse como dato.
  expect(conForma({error:{code:"NOT_FOUND"}},FORMA.snap)).toBeNull();
  for(const v of [null,undefined,"texto",42,[1,2]])expect(conForma(v,["a"]),String(v)).toBeNull();
 });
 it("las claves exigidas son las que la vista indexa de verdad",()=>{
  // Si esta lista se queda corta, la comprobación pasa y la pantalla revienta igual al indexar.
  expect(FORMA.snap).toContain("demographics");
  expect(FORMA.snap).toContain("labs");
  expect(FORMA.consTabs).toContain("medications"); // la medicación vigente del expediente (WS1-14)
  expect(FORMA.vitHist).toContain("records");
  expect(FORMA.fuSnap).toContain("tasks");
  for(const[k,v]of Object.entries(FORMA))expect(v.length,`${k}: sin claves exigidas`).toBeGreaterThan(0);
 });
});

describe("lo que pasa mientras la pantalla está ocupada o el dato viene mal (R05b-30, R05b-18, R05b-22)",()=>{
 it("una sugerencia CIE-10 no se puede pulsar mientras se está guardando",()=>{
  // Antes solo cambiaba el cursor: el `onClick` seguía activo y un doble clic añadía el problema dos veces.
  // El buscador CIE-10 del encuentro se unificó en _encounter.tsx (montado en el expediente).
  const src=vista("_encounter.tsx");
  expect(src,"el manejador tiene que consultar el estado de guardado").toMatch(/act\(\(\)=>\{if\(cDxBusy\)return;/);
  expect(src,"y anunciarse como deshabilitado").toContain("aria-disabled={cDxBusy||undefined}");
 });
 it("si hay más hallazgos de los que caben, la pantalla lo dice",()=>{
  // Hallazgos clínicos deterministas recortados en silencio: el médico no podía saber que había más.
  const src=vista("exp.tsx");
  expect(src,"debe declarar cuántos no se muestran").toMatch(/snap\.findings\.length>6&&/);
  expect(src).toMatch(/no mostrados/);
 });
 it("una serie con valores no finitos no se dibuja como si fuera plana",()=>{
  for(const f of ["signos.tsx","seguimiento.tsx"]){
   const src=vista(f);
   const i=src.indexOf("const spark=");
   expect(i,`${f}: no se encontró spark`).toBeGreaterThan(-1);
   const fn=src.slice(i,i+900);
   expect(fn,`${f}: debe quedarse solo con los valores finitos`).toContain("Number.isFinite");
   expect(fn,`${f}: y no dibujar nada si no queda ninguno`).toMatch(/if\(!finitos\.length\)return null/);
  }
 });
});

describe("en qué reloj se agenda una cita (R05b-16)",()=>{
 it("la pantalla declara la zona que de verdad se está usando",()=>{
  const z=zonaDelNavegador();
  expect(z.length).toBeGreaterThan(0);
  expect(avisoDeZona(""),"sin zona del consultorio, se dice la del equipo").toContain(z);
  expect(avisoDeZona("")).toMatch(/UTC/);
 });
 it("y avisa cuando el consultorio está configurado en otra zona, en vez de resolverlo en silencio",()=>{
  const aviso=avisoDeZona("Europe/Madrid");
  expect(aviso).toContain("Europe/Madrid");
  expect(aviso,"tiene que pedir confirmación: la cita puede quedar a otra hora").toMatch(/[Cc]onfirme/);
  // Si coincide con la del equipo, no se inventa una discrepancia.
  expect(avisoDeZona(zonaDelNavegador())).not.toMatch(/Confirme/);
 });
 it("el campo de la cita está descrito por ese aviso",()=>{
  const src=vista("exp.tsx");
  expect(src).toContain('aria-describedby="mos-zona-cita"');
  expect(src).toContain("avisoDeZona(cfgSettings.timezone)");
 });
});
