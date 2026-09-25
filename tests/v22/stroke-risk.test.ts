import{describe,it,expect}from"vitest";
import{cha2ds2vasc,STROKE_RISK_ALGORITHM}from"../../packages/stroke-risk/src";
// EPIC BQ — riesgo tromboembólico en fibrilación auricular.
//
// Cotejo de guías, decisión D1 (24-sep-2026): el módulo pasó de CHA₂DS₂-VASc a **CHA₂DS₂-VA (ESC 2024)**. Dos guías vigentes
// discrepaban —la ESC 2024 elimina la categoría de sexo, la ACC/AHA 2023 la mantiene— y el dueño eligió la más reciente y la
// que sustenta el cambio con re-análisis de discriminación. Estas pruebas fijan el cambio: el sexo NO puntúa y los umbrales
// son iguales para ambos sexos. Antes fijaban lo contrario, que es lo que había que cambiar.
const base={ageYears:60,female:false,chf:false,hypertension:false,diabetes:false,strokeHistory:false,vascularDisease:false};
describe("cha2ds2va (ESC 2024)",()=>{
 it("el algoritmo aplicado se declara, con la guía y lo que sustituye",()=>{
  expect(STROKE_RISK_ALGORITHM.id).toBe("CHA2DS2-VA-ESC-2024");
  expect(STROKE_RISK_ALGORITHM.guideline).toBe("ESC 2024");
  expect(STROKE_RISK_ALGORITHM.supersedes).toMatch(/VASc/);
  expect(cha2ds2vasc(base)!.algorithm.label).toBe("CHA₂DS₂-VA");
 });
 it("el SEXO no suma puntos: es la invariante del cambio de guía",()=>{
  // Con VASc, una mujer de 60 sin factores puntuaba 1. Con VA puntúa 0, y el umbral ya no depende del sexo.
  const mujer=cha2ds2vasc({...base,female:true})!,hombre=cha2ds2vasc(base)!;
  expect(mujer.score).toBe(hombre.score);
  expect(mujer.score).toBe(0);
  expect(Object.keys(mujer.components),"el componente de sexo desaparece del puntaje").not.toContain("female");
  // Y el sexo se sigue informando como modificador: se consideró, no se ignoró.
  expect(mujer.sexModifier).toMatch(/modificador de riesgo, NO suma puntos/);
  expect(hombre.sexModifier).toMatch(/no modifica el puntaje/);
 });
 it("los umbrales son IGUALES para ambos sexos (ESC 2024)",()=>{
  // Con VASc, el mismo puntaje significaba cosas distintas según el sexo. Eso es lo que la guía quitó.
  for(const female of [false,true]){
   expect(cha2ds2vasc({...base,female})!.risk,`score 0, female=${female}`).toBe("LOW");
   expect(cha2ds2vasc({...base,female,hypertension:true})!.risk,`score 1, female=${female}`).toBe("INTERMEDIATE");
   expect(cha2ds2vasc({...base,female,hypertension:true,diabetes:true})!.risk,`score 2, female=${female}`).toBe("HIGH");
  }
 });
 it("hombre 60 sin factores -> score 0, LOW, sin antitrombótico",()=>{
  const r=cha2ds2vasc(base)!;expect(r.score).toBe(0);expect(r.risk).toBe("LOW");
 });
 it("edad 65–74 suma 1; edad>=75 suma 2",()=>{
  expect(cha2ds2vasc({...base,ageYears:70})!.components.age).toBe(1);
  expect(cha2ds2vasc({...base,ageYears:80})!.components.age).toBe(2);
 });
 it("ictus previo suma 2",()=>{
  expect(cha2ds2vasc({...base,strokeHistory:true})!.components.stroke).toBe(2);
 });
 it("suma correcta: mujer 76 con HTA+DM+IC -> 2(edad)+1(HTA)+1(DM)+1(IC)=5, HIGH (el sexo no suma)",()=>{
  const r=cha2ds2vasc({...base,ageYears:76,female:true,hypertension:true,diabetes:true,chf:true})!;
  expect(r.score).toBe(5);expect(r.risk).toBe("HIGH");expect(r.recommendation).toMatch(/recomendada/i);
 });
 it("una mujer sin factores reales NO queda en riesgo intermedio por su sexo",()=>{
  // Era el efecto del punto por sexo en VASc: bastaba ser mujer para salir del cero.
  expect(cha2ds2vasc({...base,female:true})!.risk).toBe("LOW");
  expect(cha2ds2vasc({...base,female:true})!.score).toBe(0);
 });
 it("hombre score>=2 -> HIGH (anticoagular)",()=>{
  expect(cha2ds2vasc({...base,hypertension:true,diabetes:true})!.risk).toBe("HIGH");
 });
 it("no publica un riesgo anual inventado (R03-03: la tabla no era monótona) y sí los componentes",()=>{
  const r=cha2ds2vasc({...base,hypertension:true,diabetes:true})!;
  expect(Object.keys(r.components)).toContain("vascular");
  expect((r as Record<string,unknown>)["annualStrokeRiskPct"],
   "un porcentaje de riesgo anual exige una cohorte citada; la tabla previa daba 9.6% con score 7 y 6.7% con score 8").toBeUndefined();
 });
 it("R03-03: el riesgo hemorrágico se declara NO evaluado y la recomendación lo advierte",()=>{
  const r=cha2ds2vasc({...base,hypertension:true,diabetes:true})!;
  expect(r.bleedingRiskAssessed).toBe(false);
  expect(r.recommendation).toMatch(/hemorrágico/i);
  // En riesgo BAJO no hay indicación que contrapesar, así que no se añade la advertencia.
  expect(cha2ds2vasc(base)!.recommendation).not.toMatch(/HAS-BLED/);
 });
});
