import{describe,it,expect}from"vitest";
import{curb65,curb65Check,CURB65_MIN_AGE_YEARS}from"../../packages/pneumonia-severity/src";
// EPIC BZ — CURB-65.
const base={confusion:false,bun:10,respRate:18,systolic:120,diastolic:80,ageYears:50};
describe("curb65",()=>{
 it("paciente joven estable -> score 0, LOW, ambulatorio",()=>{
  const r=curb65(base)!;expect(r.score).toBe(0);expect(r.risk).toBe("LOW");
 });
 it("cada criterio suma 1",()=>{
  expect(curb65({...base,confusion:true})!.criteria.confusion).toBe(1);
  expect(curb65({...base,bun:25})!.criteria.urea).toBe(1);      // BUN>19
  expect(curb65({...base,respRate:32})!.criteria.resp).toBe(1); // FR>=30
  expect(curb65({...base,systolic:85})!.criteria.bp).toBe(1);   // sist<90
  expect(curb65({...base,diastolic:58})!.criteria.bp).toBe(1);  // diast<=60
  expect(curb65({...base,ageYears:70})!.criteria.age).toBe(1);  // edad>=65
 });
 it("score 2 -> MODERATE (considerar ingreso)",()=>{
  expect(curb65({...base,ageYears:70,bun:25})!.risk).toBe("MODERATE");
 });
 it("score 3+ -> HIGH (ingreso)",()=>{
  const r=curb65({...base,ageYears:70,bun:25,respRate:32})!;
  expect(r.score).toBe(3);expect(r.risk).toBe("HIGH");expect(r.recommendation).toMatch(/ingreso/i);
 });
 it("valores inválidos -> undefined",()=>{
  expect(curb65({...base,bun:NaN})).toBeUndefined();
 });
});

// Auditoría 2026-09-19, anexo R03 (R03-18, R03-07): dominio de la escala y mortalidad con fuente.
describe("CURB-65: dominio y fuente (R03-18)",()=>{
 it("la mortalidad sale de la cohorte de Lim 2003, no de un «~» redondeado",()=>{
  expect(curb65(base)!.mortalityPct).toBe(0.7);
  expect(curb65({...base,ageYears:70,bun:25})!.mortalityPct).toBe(9.2);
  expect(curb65({...base,ageYears:70,bun:25,respRate:32})!.mortalityPct).toBe(14.5);
  expect(curb65({...base,confusion:true,ageYears:70,bun:25,respRate:32,systolic:85})!.mortalityPct).toBe(40);
  expect(curb65(base)!.mortality).toMatch(/Lim 2003/);
 });
 it("la mortalidad es monótona en el puntaje (el defecto que sí tenía CHA₂DS₂-VASc)",()=>{
  const m=[0,1,2,3,4,5].map(s=>{
   const args={...base,ageYears:70,bun:25,respRate:32,systolic:85,confusion:true};
   // se van apagando criterios para bajar el puntaje
   const off:Record<number,typeof args>={0:base,1:{...base,ageYears:70},2:{...base,ageYears:70,bun:25},
    3:{...base,ageYears:70,bun:25,respRate:32},4:{...base,ageYears:70,bun:25,respRate:32,systolic:85},5:args};
   const r=curb65(off[s]!)!;expect(r.score).toBe(s);return r.mortalityPct;
  });
  for(let i=1;i<m.length;i++)expect(m[i]!,`mortalidad ${m[i]} tras ${m[i-1]}`).toBeGreaterThanOrEqual(m[i-1]!);
 });
 it("por debajo de la edad validada NO se calcula (la escala es de adultos)",()=>{
  expect(curb65({...base,ageYears:6})).toBeUndefined();
  expect(curb65Check({...base,ageYears:6})?.reasonCode).toBe("BELOW_VALIDATED_AGE");
  expect(curb65({...base,ageYears:CURB65_MIN_AGE_YEARS})).toBeDefined();
 });
 it("valores implausibles se rechazan con motivo (antes solo se exigía que fueran finitos)",()=>{
  expect(curb65Check({...base,respRate:300})?.reasonCode).toBe("IMPLAUSIBLE_VALUE");
  expect(curb65Check({...base,systolic:12})?.reasonCode).toBe("IMPLAUSIBLE_VALUE");
  expect(curb65Check({...base,bun:0})?.reasonCode).toBe("IMPLAUSIBLE_VALUE");
  expect(curb65({...base,respRate:300})).toBeUndefined();
 });
 it("una presión invertida no se puntúa (80/120 daría bp=1 como si fuera hipotensión)",()=>{
  expect(curb65Check({...base,systolic:80,diastolic:120})?.reasonCode).toBe("BP_INVERTED");
  expect(curb65({...base,systolic:80,diastolic:120})).toBeUndefined();
 });
 it("una entrada válida no reporta rechazo",()=>{expect(curb65Check(base)).toBeUndefined();});
});
