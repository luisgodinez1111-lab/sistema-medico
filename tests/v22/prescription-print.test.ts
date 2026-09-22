import{describe,it,expect}from"vitest";
import{checkPrescriptionLegal,describeMissing,renderPrescriptionHtml,isValidCedula,isAntibiotic,isControlled,type PrescriptionData}from"../../packages/prescription-print/src";
// Auditoría 2026-09-19 (U-20, L-05): la receta imprimible cumple los requisitos legales mexicanos o no se imprime.
const base:PrescriptionData={folio:"ABC1234567",issuedAt:"2026-09-22T15:00:00.000Z",
 prescriber:{fullName:"Dra. Ana Pérez Ruiz",cedulaProfesional:"7654321",institution:"UNAM — Facultad de Medicina",specialty:"Medicina interna"},
 establishment:{name:"Consultorio Prueba",address:"Av. Reforma 1, CDMX",phone:"55 1234 5678"},
 patient:{name:"María López",ageYears:46,sexAtBirth:"FEMALE"},
 items:[{medicationId:"m1",genericName:"amoxicilina",drugCode:"amoxicilina-500",classes:["PENICILLIN","BETA_LACTAM"],dose:"500 mg",route:"VO",frequency:"c/8h",duration:"7 días",indication:"Faringoamigdalitis"}]};
describe("receta legal (U-20 / L-05)",()=>{
 it("cédula profesional: 7 u 8 dígitos",()=>{
  expect(isValidCedula("1234567")).toBe(true);expect(isValidCedula("12345678")).toBe(true);
  expect(isValidCedula("123456")).toBe(false);expect(isValidCedula("12AB567")).toBe(false);expect(isValidCedula("")).toBe(false);
 });
 it("completa -> ok; cada dato legal ausente se nombra con su ruta y su texto en español",()=>{
  expect(checkPrescriptionLegal(base)).toEqual({ok:true,missing:[]});
  const bad:PrescriptionData={...base,prescriber:{...base.prescriber,cedulaProfesional:"12"},establishment:{name:"",address:" ",phone:""},
   items:[(({duration:_d,...rest})=>({...rest,dose:""}))(base.items[0]!)]}; // sin `duration` (exactOptionalPropertyTypes)
  const c=checkPrescriptionLegal(bad);
  expect(c.ok).toBe(false);
  expect(c.missing).toEqual(["prescriber.cedulaProfesional","establishment.address","establishment.phone","items[0].dose","items[0].duration"]);
  expect(describeMissing(c.missing)).toEqual(["cédula profesional válida de 7 u 8 dígitos (perfil profesional)","domicilio del consultorio (configuración)","teléfono del consultorio (configuración)","medicamento 1: dosis","medicamento 1: duración del tratamiento"]);
  expect(checkPrescriptionLegal({...base,items:[]}).missing).toEqual(["items"]);
 });
 it("el HTML lleva todos los campos legales, la nota de antibiótico, y es determinista",()=>{
  const h=renderPrescriptionHtml(base);
  for(const s of["Dra. Ana Pérez Ruiz","7654321","UNAM — Facultad de Medicina","Medicina interna","Consultorio Prueba","Av. Reforma 1, CDMX","55 1234 5678","María López","46 años","Femenino","amoxicilina","500 mg","VO","c/8h","7 días","Faringoamigdalitis","Firma autógrafa","Folio ABC1234567","Antibiótico"])expect(h).toContain(s);
  expect(h).not.toContain("<script");
  expect(renderPrescriptionHtml(base)).toBe(h);
 });
 it("escapa todo lo que escribió el usuario (nombres, indicaciones) y muestra la anulación de barrera y los controlados",()=>{
  const d:PrescriptionData={...base,patient:{name:"Pedro <script>alert(1)</script>"},
   items:[{...base.items[0]!,genericName:"tramadol",drugCode:"tramadol-50",classes:["OPIOID"],indication:'Dolor "intenso" & agudo',override:{barriers:["interaction"]}}]};
  const h=renderPrescriptionHtml(d);
  expect(h).not.toContain("<script>");expect(h).toContain("&lt;script&gt;");
  expect(h).toContain("&quot;intenso&quot; &amp; agudo");
  expect(h).toContain("anulación justificada de barrera(s): interaction");
  expect(h).toContain("Medicamento controlado");
  expect(isControlled(["OPIOID"])).toBe(true);expect(isAntibiotic(["OPIOID"])).toBe(false);expect(isAntibiotic(["MACROLIDE"])).toBe(true);
 });
 it("sin edad ni sexo se dice 'Edad no registrada' en lugar de inventar",()=>{
  const h=renderPrescriptionHtml({...base,patient:{name:"X"}});
  expect(h).toContain("Edad no registrada");expect(h).not.toContain("años");
 });
});
