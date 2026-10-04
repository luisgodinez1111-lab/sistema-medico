import{describe,it,expect}from"vitest";
import{defaultUnitFor,unidadesDe}from"../../apps/web/app/workspace/shared";
import{vitalUnitAccepted}from"../../packages/lab-reference/src";
// S-CONFIG «Sistema de unidades» (prefUnits): `defaultUnitFor` elige la unidad POR DEFECTO al capturar un signo. Es solo
// captura/presentación — el valor se guarda con su unidad + canónico y los cálculos usan el canónico (ver vital-lifecycle).
// Esta guarda fija el contrato: imperial preselecciona lb/in/°F donde existe; métrico y los tipos sin conversión, la canónica;
// y TODA unidad devuelta debe ser ACEPTADA por el servidor (si no, la escritura del vital se rechazaría).
describe("unidad por defecto de captura según el sistema de unidades (prefUnits)",()=>{
 it("Imperial preselecciona lb / in / °F en peso, talla y temperatura",()=>{
  expect(defaultUnitFor("WEIGHT","Imperial (lb, in)")).toBe("lb");
  expect(defaultUnitFor("HEIGHT","Imperial (lb, in)")).toBe("in");
  expect(defaultUnitFor("TEMP","Imperial (lb, in)")).toBe("°f");
 });
 it("Métrico usa la unidad canónica (kg / cm / °C)",()=>{
  expect(defaultUnitFor("WEIGHT","Métrico (kg, cm)")).toBe("kg");
  expect(defaultUnitFor("HEIGHT","Métrico (kg, cm)")).toBe("cm");
  expect(defaultUnitFor("TEMP","Métrico (kg, cm)")).toBe("°C");
 });
 it("los tipos sin conversión no cambian de unidad en Imperial",()=>{
  for(const t of ["BP","HR","RESP","SPO2"])
   expect(defaultUnitFor(t,"Imperial (lb, in)"),t).toBe(unidadesDe(t)[0]);
 });
 it("toda unidad por defecto es ACEPTADA por el servidor (no rechazaría la escritura)",()=>{
  for(const sys of ["Métrico (kg, cm)","Imperial (lb, in)"])
   for(const t of ["WEIGHT","HEIGHT","TEMP","BP","HR","RESP","SPO2"]){
    const u=defaultUnitFor(t,sys);
    expect(vitalUnitAccepted(t,u),`${t} «${u}» (${sys}) debe ser una unidad aceptada`).toBe(true);
   }
 });
});
