import{describe,it,expect}from"vitest";
import{cha2ds2vasc}from"../../packages/stroke-risk/src";
// EPIC BQ — CHA₂DS₂-VASc.
const base={ageYears:60,female:false,chf:false,hypertension:false,diabetes:false,strokeHistory:false,vascularDisease:false};
describe("cha2ds2vasc",()=>{
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
 it("suma correcta: mujer 76 con HTA+DM+IC -> 2(edad)+1(HTA)+1(DM)+1(IC)+1(sexo)=6, HIGH",()=>{
  const r=cha2ds2vasc({...base,ageYears:76,female:true,hypertension:true,diabetes:true,chf:true})!;
  expect(r.score).toBe(6);expect(r.risk).toBe("HIGH");expect(r.recommendation).toMatch(/recomendada/i);
 });
 it("umbral sexo-específico: mujer con score 1 (solo sexo) -> LOW; hombre score 1 -> INTERMEDIATE",()=>{
  expect(cha2ds2vasc({...base,female:true})!.risk).toBe("LOW");          // solo el punto por sexo
  expect(cha2ds2vasc({...base,hypertension:true})!.risk).toBe("INTERMEDIATE"); // hombre, 1 factor real
 });
 it("hombre score>=2 -> HIGH (anticoagular)",()=>{
  expect(cha2ds2vasc({...base,hypertension:true,diabetes:true})!.risk).toBe("HIGH");
 });
 it("incluye riesgo anual y componentes",()=>{
  const r=cha2ds2vasc({...base,hypertension:true,diabetes:true})!;
  expect(r.annualStrokeRiskPct).toBeGreaterThan(0);
  expect(Object.keys(r.components)).toContain("vascular");
 });
});
