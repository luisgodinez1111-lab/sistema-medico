import{describe,it,expect}from"vitest";
import{interpretAcidBase,acidBaseCheck,phFromGases,GAS_BOUNDS,HH_TOLERANCE}from"../../packages/acid-base/src";
// EPIC BX — Interpretación ácido-base. Auditoría 2026-09-19, anexo R03: R03-05 (brecha aniónica y delta-delta),
// R03-06 (las cuatro reglas de compensación, no solo Winters) y R03-07 (coherencia interna, cotas y tipo de muestra).
const ART={specimen:"ARTERIAL"}as const;
describe("interpretAcidBase",()=>{
 it("normal: pH 7.40, pCO2 40, HCO3 24 -> NORMAL",()=>{
  const r=interpretAcidBase(7.40,40,24,ART)!;expect(r.status).toBe("NORMAL");expect(r.primary).toBe("NORMAL");
 });
 it("acidosis metabólica compensada adecuadamente (Winters): pH 7.30, HCO3 12, pCO2 26",()=>{
  const r=interpretAcidBase(7.30,26,12,ART)!; // esperado = 1.5*12+8 = 26
  expect(r.primary).toBe("METABOLIC_ACIDOSIS");
  expect(r.expectedPco2).toBe(26);
  expect(r.compensation).toMatch(/adecuada/i);
  expect(r.compensationAssessed).toBe(true);
 });
 it("acidosis metabólica + acidosis respiratoria concurrente (pCO2 mayor al esperado)",()=>{
  const r=interpretAcidBase(7.10,40,12,ART)!; // esperado 26, medido 40 -> respiratoria concurrente
  expect(r.compensation).toMatch(/respiratoria concurrente/i);
 });
 it("acidosis metabólica + alcalosis respiratoria concurrente (pCO2 menor al esperado)",()=>{
  // El vector tiene que ser POSIBLE: con HCO₃ 12 solo se es acidémico hasta pCO₂ ≈22.4, así que la ventana en la que el
  // pCO₂ baja de Winters−2 (24) y el pH sigue por debajo de 7.35 es estrecha. Antes cualquier tripleta valía.
  const r=interpretAcidBase(7.34,23,12,ART)!; // esperado 26, medido 23 -> sobrecompensación
  expect(r.primary).toBe("METABOLIC_ACIDOSIS");
  expect(r.compensation).toMatch(/sobrecompensaci/i);
 });
 it("acidosis respiratoria: pH 7.28, pCO2 60, HCO3 28",()=>{
  expect(interpretAcidBase(7.28,60,28,ART)!.primary).toBe("RESPIRATORY_ACIDOSIS");
 });
 it("alcalosis metabólica: pH 7.50, HCO3 34, pCO2 44",()=>{
  expect(interpretAcidBase(7.50,44,34,ART)!.primary).toBe("METABOLIC_ALKALOSIS");
 });
 it("alcalosis respiratoria: pH 7.50, pCO2 28, HCO3 21",()=>{
  expect(interpretAcidBase(7.50,28,21,ART)!.primary).toBe("RESPIRATORY_ALKALOSIS");
 });
 it("valores inválidos -> undefined",()=>{
  expect(interpretAcidBase(0,40,24,ART)).toBeUndefined();
  expect(interpretAcidBase(7.4,NaN,24,ART)).toBeUndefined();
 });
});

describe("coherencia interna de la gasometría (R03-07)",()=>{
 it("Henderson-Hasselbalch reproduce el pH a partir de pCO₂ y HCO₃",()=>{
  expect(phFromGases(40,24)).toBeCloseTo(7.40,2);
  expect(phFromGases(40,5)).toBeCloseTo(6.72,1); // el caso del anexo: imposible con pH 7.40
 });
 it("un panel físicamente imposible se RECHAZA (antes se clasificaba sin objeción)",()=>{
  const rej=acidBaseCheck(7.40,40,5);
  expect(rej?.reasonCode).toBe("GAS_PANEL_INCONSISTENT");
  expect(rej?.detail).toMatch(/transposición/);
  expect(interpretAcidBase(7.40,40,5,ART)).toBeUndefined();
 });
 it("una transposición de pCO₂ y HCO₃ no pasa como interpretación normal",()=>{
  // pH 7.40 con pCO₂ 24 y HCO₃ 40 (campos invertidos) implicaría pH 7.84.
  expect(acidBaseCheck(7.40,24,40)?.reasonCode).toBe("GAS_PANEL_INCONSISTENT");
 });
 it("las cotas de plausibilidad están declaradas y se aplican",()=>{
  expect(GAS_BOUNDS.ph).toEqual([6.5,7.9]);
  expect(acidBaseCheck(13,40,24)?.reasonCode).toBe("IMPLAUSIBLE_VALUE");
  expect(acidBaseCheck(7.4,900,24)?.reasonCode).toBe("IMPLAUSIBLE_VALUE");
  expect(acidBaseCheck(7.4,40,200)?.reasonCode).toBe("IMPLAUSIBLE_VALUE");
 });
 it("un panel coherente dentro de la tolerancia pasa",()=>{
  expect(acidBaseCheck(7.40,40,24)).toBeUndefined();
  expect(HH_TOLERANCE).toBe(0.05);
 });
 it("de una muestra VENOSA no se juzga la compensación respiratoria",()=>{
  const v=interpretAcidBase(7.30,26,12,{specimen:"VENOUS"})!;
  expect(v.primary).toBe("METABOLIC_ACIDOSIS");
  expect(v.compensationAssessed).toBe(false);
  expect(v.expectedPco2).toBeUndefined();
  expect(v.interpretation).toMatch(/VENOSA/);
  expect(v.interpretation).toMatch(/gasometría arterial/);
 });
});

describe("compensación de los cuatro trastornos (R03-06)",()=>{
 // El caso del anexo: EPOC retenedor de CO₂. Agudo esperaría HCO₃ 26.2; crónico 31.7. El medido (32) es crónico.
 const epoc=[7.33,62,32]as const;
 it("el EPOC retenedor se distingue del que se descompensa (sin declarar cronicidad, ambos escenarios)",()=>{
  const r=interpretAcidBase(epoc[0],epoc[1],epoc[2],ART)!;
  expect(r.primary).toBe("RESPIRATORY_ACIDOSIS");
  expect(r.scenarios).toHaveLength(2);
  expect(r.scenarios!.find(s=>s.chronicity==="ACUTE")!.expectedHco3).toBe(26.2);
  expect(r.scenarios!.find(s=>s.chronicity==="CHRONIC")!.expectedHco3).toBe(31.7);
  expect(r.scenarios!.find(s=>s.chronicity==="CHRONIC")!.matches).toBe(true);
  expect(r.scenarios!.find(s=>s.chronicity==="ACUTE")!.matches).toBe(false);
  expect(r.compensation).toMatch(/CRÓNICA/);
 });
 it("declarando la cronicidad, el veredicto es único",()=>{
  const cr=interpretAcidBase(epoc[0],epoc[1],epoc[2],{...ART,chronicity:"CHRONIC"})!;
  expect(cr.expectedHco3).toBe(31.7);expect(cr.compensation).toMatch(/acorde con una forma crónica/);
  const ag=interpretAcidBase(epoc[0],epoc[1],epoc[2],{...ART,chronicity:"ACUTE"})!;
  expect(ag.expectedHco3).toBe(26.2);expect(ag.compensation).toMatch(/Alcalosis metabólica concurrente/);
 });
 it("acidosis respiratoria AGUDA: HCO₃ apenas sube (+1 por cada 10 mmHg)",()=>{
  const r=interpretAcidBase(7.21,60,26,{...ART,chronicity:"ACUTE"})!;
  expect(r.primary).toBe("RESPIRATORY_ACIDOSIS");
  expect(r.expectedHco3).toBe(26);expect(r.compensation).toMatch(/acorde con una forma aguda/);
 });
 it("alcalosis metabólica: pCO₂ esperado = 40 + 0.7·ΔHCO₃",()=>{
  const r=interpretAcidBase(7.50,47,34,ART)!;
  expect(r.primary).toBe("METABOLIC_ALKALOSIS");
  expect(r.expectedPco2).toBe(47);expect(r.compensation).toMatch(/adecuada/);
  const sin=interpretAcidBase(7.58,40,34,ART)!;
  expect(sin.compensation).toMatch(/no hay hipoventilación compensadora/);
 });
 it("alcalosis respiratoria crónica: el HCO₃ esperado BAJA (−4 por cada 10 mmHg)",()=>{
  const r=interpretAcidBase(7.46,30,20,{...ART,chronicity:"CHRONIC"})!;
  expect(r.primary).toBe("RESPIRATORY_ALKALOSIS");
  expect(r.expectedHco3).toBe(20);expect(r.compensation).toMatch(/acorde con una forma crónica/);
 });
});

describe("brecha aniónica y delta-delta dentro del análisis (R03-05)",()=>{
 it("la acidosis metabólica se bifurca en brecha aumentada vs hiperclorémica",()=>{
  const alta=interpretAcidBase(7.20,25,10,{...ART,anionGap:24})!;
  expect(alta.anionGapBranch).toBe("HIGH_AG");
  expect(alta.interpretation).toMatch(/cetoacidosis/);
  const normal=interpretAcidBase(7.20,25,10,{...ART,anionGap:10})!;
  expect(normal.anionGapBranch).toBe("NORMAL_AG");
  expect(normal.interpretation).toMatch(/hiperclorémica/);
 });
 it("delta-delta: ΔAG/ΔHCO₃ distingue la pura de la mixta y de la alcalosis concurrente",()=>{
  // AG 24 (Δ12), HCO₃ 10 (Δ14) -> 0.86 = pura
  expect(interpretAcidBase(7.20,25,10,{...ART,anionGap:24})!.deltaRatio).toBe(0.86);
  // AG 18 (Δ6), HCO₃ 10 (Δ14) -> 0.43 = mixta con hiperclorémica
  const mixta=interpretAcidBase(7.20,25,10,{...ART,anionGap:18})!;
  expect(mixta.deltaRatio).toBe(0.43);expect(mixta.deltaInterpretation).toMatch(/mixta/);
  // AG 40 (Δ28), HCO₃ 20 (Δ4) -> 7 = alcalosis metabólica concurrente
  const alc=interpretAcidBase(7.32,40,20,{...ART,anionGap:40})!;
  expect(alc.deltaRatio).toBe(7);expect(alc.deltaInterpretation).toMatch(/alcalosis metabólica concurrente/i);
 });
 it("si la brecha viene corregida por albúmina, la interpretación lo dice",()=>{
  const r=interpretAcidBase(7.20,25,10,{...ART,anionGap:17,anionGapCorrected:true})!;
  expect(r.anionGapBranch).toBe("HIGH_AG");
  expect(r.interpretation).toMatch(/corregida por albúmina/);
 });
 it("sin brecha aniónica no se inventa la rama (queda sin bifurcar)",()=>{
  const r=interpretAcidBase(7.20,25,10,ART)!;
  expect(r.anionGapBranch).toBeUndefined();expect(r.deltaRatio).toBeUndefined();
 });
 it("el pH calculado se devuelve siempre (control de coherencia visible para quien lee)",()=>{
  expect(interpretAcidBase(7.40,40,24,ART)!.phCalculated).toBeCloseTo(7.40,2);
 });
});
