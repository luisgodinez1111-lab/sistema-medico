import{describe,it,expect}from"vitest";
import{defaultUnitFor,unidadesDe}from"../../apps/web/app/workspace/shared";
import{vitalUnitAccepted,vitalForDisplay}from"../../packages/lab-reference/src";
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
// CONVERSIÓN SOLO-DISPLAY de vitales históricos a la unidad preferida (no toca dato ni cálculos).
describe("vitalForDisplay — presentación en la unidad preferida",()=>{
 it("convierte peso/talla/temperatura a imperial desde el valor canónico capturado",()=>{
  expect(vitalForDisplay("WEIGHT","70","kg",true)).toEqual({value:"154.3",unit:"lb"});      // 70 kg → 154.3 lb
  expect(vitalForDisplay("HEIGHT","170","cm",true)).toEqual({value:"66.9",unit:"in"});       // 170 cm → 66.9 in
  expect(vitalForDisplay("TEMP","37","°C",true)).toEqual({value:"98.6",unit:"°F"});          // 37 °C → 98.6 °F
 });
 it("en métrico muestra las canónicas (y convierte lo capturado en imperial a métrico)",()=>{
  expect(vitalForDisplay("WEIGHT","70","kg",false)).toEqual({value:"70",unit:"kg"});
  expect(vitalForDisplay("WEIGHT","154.3","lb",false)).toEqual({value:"70",unit:"kg"});       // lb capturado → kg en métrico
  expect(vitalForDisplay("TEMP","98.6","°F",false)).toEqual({value:"37",unit:"°C"});
 });
 it("round-trip estable: capturado ya en la unidad preferida no deriva",()=>{
  expect(vitalForDisplay("WEIGHT","154","lb",true)).toEqual({value:"154",unit:"lb"});
  expect(vitalForDisplay("HEIGHT","67","in",true)).toEqual({value:"67",unit:"in"});
 });
 it("no toca tipos sin conversión (BP/HR/RESP/SpO₂)",()=>{
  expect(vitalForDisplay("BP","120/80","mmHg",true)).toEqual({value:"120/80",unit:"mmHg"});
  expect(vitalForDisplay("HR","72","lpm",true)).toEqual({value:"72",unit:"lpm"});
 });
 it("INVARIANTE: valor no numérico o unidad desconocida se muestra TAL CUAL (nunca inventa)",()=>{
  expect(vitalForDisplay("WEIGHT","s/d","kg",true)).toEqual({value:"s/d",unit:"kg"});
  expect(vitalForDisplay("WEIGHT","70","quintales",true)).toEqual({value:"70",unit:"quintales"});
 });
});
