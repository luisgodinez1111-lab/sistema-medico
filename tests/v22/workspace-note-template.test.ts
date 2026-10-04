import{describe,it,expect}from"vitest";
import{composeClinicalNote,type NoteFields}from"../../apps/web/app/workspace/shared";
// S-CONFIG «Plantilla de nota» (prefNoteTemplate): da FORMATO a la nota desde los MISMOS campos capturados, sin inventar
// secciones. Esta guarda fija el contrato de las tres plantillas y, sobre todo, la INVARIANTE CLÍNICA: ningún formato
// introduce contenido que no esté en los campos (nunca fabrica datos).
const F:NoteFields={motivo:"Cefalea de 3 días",historia:"Opresiva, sin aura",interrog:"Negado por aparatos",explor:"TA 120/80, resto normal",ascites:"",encef:"",dx:"G43.9 Migraña"};
describe("plantilla de nota (composeClinicalNote)",()=>{
 it("SOAP (por defecto) usa encabezados descriptivos",()=>{
  const n=composeClinicalNote("Consulta general (SOAP)",F);
  expect(n).toContain("MOTIVO DE CONSULTA: Cefalea de 3 días");
  expect(n).toContain("HISTORIA DE LA ENFERMEDAD ACTUAL: Opresiva, sin aura");
  expect(n).toContain("INTERROGATORIO POR APARATOS Y SISTEMAS: Negado por aparatos");
  expect(n).toContain("EXPLORACIÓN FÍSICA: TA 120/80, resto normal");
  expect(n).toContain("IMPRESIÓN DIAGNÓSTICA: G43.9 Migraña");
  expect(n).not.toContain("NOTA DE PROCEDIMIENTO");
  expect(n).not.toMatch(/S \(subjetivo\)/);
 });
 it("plantilla vacía = comportamiento SOAP (byte-idéntico al anterior)",()=>{
  expect(composeClinicalNote("",F)).toBe(composeClinicalNote("Consulta general (SOAP)",F));
 });
 it("Nota de evolución usa formato S/O/A compacto (Plan va aparte)",()=>{
  const n=composeClinicalNote("Nota de evolución",F);
  expect(n).toMatch(/^S \(subjetivo\): Cefalea de 3 días Opresiva, sin aura Negado por aparatos/m);
  expect(n).toMatch(/O \(objetivo\): TA 120\/80, resto normal/);
  expect(n).toMatch(/A \(análisis\): G43.9 Migraña/);
  expect(n).not.toContain("MOTIVO DE CONSULTA");
 });
 it("Nota de procedimiento titula pero conserva las secciones descriptivas (no fabrica secciones)",()=>{
  const n=composeClinicalNote("Nota de procedimiento",F);
  expect(n.startsWith("NOTA DE PROCEDIMIENTO")).toBe(true);
  expect(n).toContain("EXPLORACIÓN FÍSICA: TA 120/80, resto normal");
 });
 it("INVARIANTE: ningún formato introduce texto que no venga de un campo capturado",()=>{
  const vals=[F.motivo,F.historia,F.interrog,F.explor,F.dx];
  for(const tpl of ["Consulta general (SOAP)","Nota de evolución","Nota de procedimiento"]){
   // Se quitan los ENCABEZADOS declarados y el título; lo que reste debe ser solo contenido de los campos (o vacío).
   let rest=composeClinicalNote(tpl,F)
     .replace(/NOTA DE PROCEDIMIENTO|MOTIVO DE CONSULTA:|HISTORIA DE LA ENFERMEDAD ACTUAL:|INTERROGATORIO POR APARATOS Y SISTEMAS:|EXPLORACIÓN FÍSICA:|IMPRESIÓN DIAGNÓSTICA:|VALORACIÓN HEPÁTICA \(Child-Pugh\):|S \(subjetivo\):|O \(objetivo\):|A \(análisis\):/g,"");
   for(const v of vals)rest=rest.split(v).join("");
   expect(rest.replace(/[\s\n]/g,""),`${tpl}: texto fuera de los campos capturados`).toBe("");
  }
 });
 it("sin campos, cada plantilla da un marcador neutro, nunca contenido inventado",()=>{
  const empty:NoteFields={motivo:"",historia:"",interrog:"",explor:"",ascites:"",encef:"",dx:""};
  expect(composeClinicalNote("Consulta general (SOAP)",empty)).toBe("Consulta registrada.");
  expect(composeClinicalNote("Nota de evolución",empty)).toBe("Nota de evolución registrada.");
 });
});
