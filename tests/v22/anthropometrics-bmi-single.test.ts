import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{bmiFromVitals,heightToMetersWithUnit}from"../../packages/anthropometrics/src";
// Auditoría 2026-09-19 (C-21): cuatro implementaciones del IMC y seis parsers de presión arterial divergían; el IMC infería
// la unidad de la talla por la magnitud. Ahora hay UNA implementación de cada cosa y la unidad se usa cuando existe.
describe("bmiFromVitals — implementación única",()=>{
 it("con unidad explícita no se adivina: 170 cm y 1.70 m dan el mismo IMC; 170 'm' es implausible",()=>{
  expect(bmiFromVitals({value:"70",unit:"kg"},{value:"170",unit:"cm"})).toMatchObject({bmi:24.2,heightUnitAssumed:false});
  expect(bmiFromVitals({value:"70",unit:"kg"},{value:"1.70",unit:"m"})).toMatchObject({bmi:24.2,heightUnitAssumed:false});
  expect(bmiFromVitals({value:"70",unit:"kg"},{value:"170",unit:"m"})).toBeUndefined();
 });
 it("sin unidad se infiere por magnitud y se DECLARA (heightUnitAssumed)",()=>{
  expect(bmiFromVitals({value:"70"},{value:"170"})).toMatchObject({bmi:24.2,heightUnitAssumed:true});
  expect(bmiFromVitals({value:"70"},{value:"1.7"})).toMatchObject({bmi:24.2,heightUnitAssumed:true});
 });
 it("peso en libras o gramos se convierte; datos ausentes o inválidos -> undefined (nunca NaN ni 0)",()=>{
  expect(bmiFromVitals({value:"154.3",unit:"lb"},{value:"170",unit:"cm"})?.bmi).toBe(24.2);
  expect(bmiFromVitals({value:"70000",unit:"g"},{value:"170",unit:"cm"})?.bmi).toBe(24.2);
  for(const[w,h]of[[undefined,"170"],["70",undefined],["","170"],["abc","170"],["70","0"]] as const)expect(bmiFromVitals({value:w},{value:h}),`${w}/${h}`).toBeUndefined();
 });
 it("heightToMetersWithUnit rechaza tallas fuera de rango en cualquier unidad",()=>{
  expect(heightToMetersWithUnit(17,"cm")).toBeUndefined();expect(heightToMetersWithUnit(300,"cm")).toBeUndefined();expect(heightToMetersWithUnit(1700,"mm")?.meters).toBe(1.7);
 });
});
describe("no quedan implementaciones paralelas en la app (guardia de regresión)",()=>{
 it("ninguna ruta ni lib calcula el IMC ni parsea la presión por su cuenta",()=>{
  const files=[...walk("apps/web/app"),...walk("apps/web/lib")].filter(f=>/\.tsx?$/.test(f));
  const bad=files.filter(f=>{const s=fs.readFileSync(f,"utf8");return /Math\.pow\(Number\(height|\/\^\(\\d\{2,3\}\)\//.test(s)||/split\("\/"\)\[0\]/.test(s)||/^function (imcOf|sys)\(/m.test(s);});
  expect(bad).toEqual([]);
 });
});
function walk(dir:string):string[]{return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);}
