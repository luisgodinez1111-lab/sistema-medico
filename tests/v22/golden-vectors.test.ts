import{describe,it,expect}from"vitest";
import{computeEGFR,schwartzBedside}from"../../packages/renal-function/src";
import{meldScore,meldNaScore}from"../../packages/meld/src";
import{fib4}from"../../packages/liver-fibrosis/src";
import{charlsonFromIcd10}from"../../packages/comorbidity/src";
import{curb65}from"../../packages/pneumonia-severity/src";
import{cha2ds2vasc}from"../../packages/stroke-risk/src";
import{aaGradient,atmPressureFromAltitude}from"../../packages/oxygenation/src";
import{interpretAcidBase,phFromGases}from"../../packages/acid-base/src";
import{anionGap}from"../../packages/lab-derivations/src";
import{bmiFromVitals}from"../../packages/anthropometrics/src";
import{estimatedAverageGlucose}from"../../packages/glycemic/src";
import{computeNEWS2,normalizeLabValue}from"../../packages/lab-reference/src";
// Auditoría 2026-09-19, anexo R03 (R03-36) — VECTORES GOLDEN CON FUENTE CITADA.
//
// El anexo buscó citas de literatura en los 19 ficheros de prueba de las calculadoras y encontró UNA: la palabra
// «Winters» en el título de un caso. Los patrones que documentó:
//   · TAUTOLOGÍA: `expect(s.overdue+s.due+s.upcoming+s.complete).toBe(f.length)` compara la suma de cuatro filtros que
//     particionan el arreglo por construcción — no puede fallar nunca;
//   · DESIGUALDADES en lugar de valores: `meld.test.ts` no tenía un solo valor exacto (`toBeGreaterThanOrEqual(35)` para
//     un caso cuyo valor real es 37), así que un error en cualquiera de los cuatro coeficientes de MELD pasaba;
//   · el test CONSAGRABA el defecto: `oxygenation.test.ts` fijaba el gradiente calculado con FiO₂ asumida.
//
// Este fichero es la respuesta: valores EXACTOS calculados de forma independiente (no copiados de la salida del código),
// cada bloque con la publicación de la que sale, los casos de borde en el umbral, y al menos un vector de UNIDAD
// EQUIVOCADA por calculadora — porque el defecto de mayor consecuencia del anexo (FIB-4 = 0.00) era de unidades.

describe("CKD-EPI 2021 · Inker LA et al., N Engl J Med 2021;385:1737-49",()=>{
 it("valores exactos de la ecuación (κ 0.7♀/0.9♂, α −0.241♀/−0.302♂, 0.9938^edad, ×1.012 si mujer)",()=>{
  expect(computeEGFR(1.0,50,"MALE")!.egfr).toBe(91.7);
  expect(computeEGFR(1.0,50,"FEMALE")!.egfr).toBe(68.6);
  expect(computeEGFR(2.5,70,"MALE")!.egfr).toBe(27.0);
 });
 it("los estadios KDIGO caen donde deben para esos valores",()=>{
  expect(computeEGFR(1.0,50,"MALE")!.stage).toBe("G1");   // 91.7 ≥ 90
  expect(computeEGFR(1.0,50,"FEMALE")!.stage).toBe("G2"); // 68.6 en 60–89
  expect(computeEGFR(2.5,70,"MALE")!.stage).toBe("G4");   // 27.0 en 15–29
 });
 it("unidad equivocada: creatinina en µmol/L (88.4 ≡ 1.0 mg/dL) NO se calcula",()=>{
  expect(computeEGFR(88.4,50,"MALE")).toBeUndefined();
 });
});

describe("Schwartz de cabecera · Schwartz GJ et al., J Am Soc Nephrol 2009;20:629-37",()=>{
 it("0.413 × talla(cm) / creatinina(mg/dL), valor exacto",()=>{
  expect(schwartzBedside(110,0.4,5)!.egfr).toBe(113.6); // 0.413·110/0.4 = 113.575
 });
});

describe("MELD · Kamath PS et al., Hepatology 2001 · bandas de Wiesner RH et al., Gastroenterology 2003;124:91-96",()=>{
 // Sin desigualdades: el valor exacto de cada vector, calculado aparte con la fórmula publicada.
 const vectores:readonly[number,number,number,boolean,number][]=[
  [1,1,1,false,6],        // todo en el suelo: el score mínimo es 6
  [2.5,1.5,1.2,false,16],
  [3,1.8,2.0,false,24],
  [3,1.8,2.0,true,30],    // en diálisis la creatinina se fija en 4.0 (UNOS): +6 puntos
  [5,2,3,false,31],
  [10,2.5,3.5,false,37],  // el caso que la prueba anterior cubría con `toBeGreaterThanOrEqual(35)`
 ];
 it("los seis vectores dan el valor exacto",()=>{
  for(const[b,i,c,d,esperado]of vectores)
   expect(meldScore(b,i,c,{dialysis:d})!.score,`bili ${b} INR ${i} creat ${c}${d?" diálisis":""}`).toBe(esperado);
 });
 it("la mortalidad es la de la tabla de Wiesner, sin rangos solapados",()=>{
  // Antes: «~20–52 %» para 20–29, que mezcla dos tramos de la tabla.
  expect(meldScore(1,1,1)!.mortality90dPct).toBe(1.9);          // ≤9
  expect(meldScore(2.5,1.5,1.2)!.mortality90dPct).toBe(6.0);    // 10–19
  expect(meldScore(3,1.8,2)!.mortality90dPct).toBe(19.6);       // 20–29
  expect(meldScore(5,2,3)!.mortality90dPct).toBe(52.6);         // 30–39
  expect(meldScore(20,4,4)!.score).toBe(40);
  expect(meldScore(20,4,4)!.mortality90dPct).toBe(71.3);        // 40
 });
 it("la mortalidad es MONÓTONA en el puntaje",()=>{
  const pares=vectores.map(([b,i,c,d])=>{const r=meldScore(b,i,c,{dialysis:d})!;return[r.score,r.mortality90dPct]as const;}).sort((a,b)=>a[0]-b[0]);
  for(let k=1;k<pares.length;k++)expect(pares[k]![1]).toBeGreaterThanOrEqual(pares[k-1]![1]);
 });
 it("MELD-Na (UNOS 2016): corrige por sodio solo por encima de 11, valor exacto",()=>{
  expect(meldNaScore(3,1.8,2,128)!.score).toBe(29);  // MELD 24 + corrección con Na 128
  expect(meldNaScore(3,1.8,2,137)!.score).toBe(24);  // Na normal: sin corrección
  expect(meldNaScore(1,1,1,120)!.score).toBe(6);     // MELD 6 ≤ 11: no se corrige
  expect(meldNaScore(3,1.8,2,128)!.version).toBe("MELD-Na-2016");
 });
 it("la salida declara que NO sirve para asignar un órgano (la asignación usa MELD 3.0 desde 2023)",()=>{
  expect(meldScore(3,1.8,2)!.version).toBe("MELD-2001");
  expect(meldScore(3,1.8,2)!.allocationNote).toMatch(/MELD 3\.0/);
  expect(meldScore(3,1.8,2)!.allocationNote).toMatch(/NO lo implementa/);
 });
});

describe("FIB-4 · Sterling RK et al., Hepatology 2006 · corte por edad: McPherson S et al., Am J Gastroenterol 2017",()=>{
 it("valor exacto con plaquetas en 10⁹/L",()=>{
  expect(fib4(55,60,40,250)!.value).toBe(2.09);   // (55·60)/(250·√40)
  expect(fib4(70,25,25,190)!.value).toBe(1.84);
 });
 it("UNIDAD EQUIVOCADA: plaquetas en /µL (250 000) ya no devuelven 0.00 «poco probable»",()=>{
  // Era el defecto de unidades de mayor consecuencia del anexo: tres órdenes de magnitud, siempre tranquilizando.
  expect(fib4(55,60,40,250000)).toBeUndefined();
 });
 it("el mismo índice cambia de interpretación a los 65 años (corte 1.3 → 2.0)",()=>{
  expect(fib4(70,25,25,190)!.risk).toBe("LOW");           // 1.84 < 2.0
  expect(fib4(50,35,25,190)!.risk).toBe("INDETERMINATE"); // 1.84 > 1.3
 });
});

describe("Charlson · Charlson ME et al., J Chronic Dis 1987 · mapeo CIE-10 de Quan H et al., Med Care 2005",()=>{
 it("el caso del anexo: 55 años con tumor metastásico y SIDA puntúa 13, no 1",()=>{
  // Antes devolvía score 1, riesgo MILD y 95.9 % de supervivencia a 10 años.
  const r=charlsonFromIcd10(55,["C78.0","B24"])!;
  expect(r.comorbidityScore).toBe(12);  // 6 + 6
  expect(r.ageScore).toBe(1);           // +1 por década desde los 50
  expect(r.score).toBe(13);
  expect(r.risk).toBe("SEVERE");
  expect(r.estimated10yrSurvivalPct).toBe(0);
 });
 it("supervivencia exacta de la fórmula 0.983^(e^(score·0.9))",()=>{
  expect(charlsonFromIcd10(45,[])!.estimated10yrSurvivalPct).toBe(98.3); // score 0
  expect(charlsonFromIcd10(45,[])!.score).toBe(0);
 });
 it("las jerarquías del índice no suman dos veces la misma condición",()=>{
  // Tumor metastásico (6) sustituye a neoplasia (2); hepatopatía grave (3) a la leve (1).
  const meta=charlsonFromIcd10(45,["C34.9","C78.0"])!;
  expect(meta.comorbidityScore).toBe(6);
  const higado=charlsonFromIcd10(45,["K74.6","K72.9"])!;
  expect(higado.comorbidityScore).toBe(3);
 });
});

describe("CURB-65 · Lim WS et al., Thorax 2003;58:377-82",()=>{
 const base={confusion:false,bun:10,respRate:18,systolic:120,diastolic:80,ageYears:50};
 it("mortalidad a 30 días exacta de la cohorte de derivación",()=>{
  expect(curb65(base)!.mortalityPct).toBe(0.7);
  expect(curb65({...base,ageYears:70})!.mortalityPct).toBe(2.1);
  expect(curb65({...base,ageYears:70,bun:25})!.mortalityPct).toBe(9.2);
  expect(curb65({...base,ageYears:70,bun:25,respRate:32})!.mortalityPct).toBe(14.5);
 });
 it("cada criterio vale exactamente 1 punto y el umbral es el publicado",()=>{
  expect(curb65({...base,bun:20})!.criteria["urea"]).toBe(1);   // BUN >19
  expect(curb65({...base,bun:19})!.criteria["urea"]).toBe(0);
  expect(curb65({...base,respRate:30})!.criteria["resp"]).toBe(1); // FR ≥30
  expect(curb65({...base,respRate:29})!.criteria["resp"]).toBe(0);
  expect(curb65({...base,ageYears:65})!.criteria["age"]).toBe(1);  // edad ≥65
  expect(curb65({...base,ageYears:64})!.criteria["age"]).toBe(0);
 });
});

describe("CHA₂DS₂-VA · 2024 ESC Guidelines for the management of atrial fibrillation (decisión D1 del cotejo de guías)",()=>{
 const base={ageYears:60,female:false,chf:false,hypertension:false,diabetes:false,strokeHistory:false,vascularDisease:false};
 it("los pesos exactos: ictus 2, edad ≥75 2, el resto 1 — y el SEXO no puntúa",()=>{
  expect(cha2ds2vasc({...base,strokeHistory:true})!.score).toBe(2);
  expect(cha2ds2vasc({...base,ageYears:75})!.score).toBe(2);
  expect(cha2ds2vasc({...base,ageYears:65})!.score).toBe(1);
  expect(cha2ds2vasc({...base,ageYears:64})!.score).toBe(0);
  // Con VASc este caso daba 6 (incluía el punto por sexo). Con VA da 5: el vector dorado cambia porque cambió la guía.
  expect(cha2ds2vasc({...base,ageYears:76,female:true,hypertension:true,diabetes:true,chf:true})!.score).toBe(5);
  expect(cha2ds2vasc({...base,female:true})!.score,"ser mujer no suma puntos").toBe(0);
 });
 it("el umbral es el MISMO para ambos sexos (ESC 2024: el sexo es modificador, no componente)",()=>{
  expect(cha2ds2vasc({...base,female:true})!.risk).toBe("LOW");
  expect(cha2ds2vasc({...base,hypertension:true})!.risk).toBe("INTERMEDIATE");
  expect(cha2ds2vasc({...base,female:true,hypertension:true})!.risk,"misma conducta que el varón con el mismo puntaje").toBe("INTERMEDIATE");
 });
});

describe("Gradiente A-a · ecuación del gas alveolar · esperado por edad: Mellemgaard K, Acta Physiol Scand 1966",()=>{
 it("PAO₂ y gradiente exactos a nivel del mar con aire ambiente",()=>{
  const r=aaGradient(60,40,60,{fio2:0.21,atmPressure:760})!;
  expect(r.alveolarPo2).toBe(99.7);     // 0.21·(760−47) − 40/0.8
  expect(r.gradient).toBe(39.7);
  expect(r.expected).toBe(15.1);        // 2.5 + 0.21·60
  expect(r.elevated).toBe(true);
 });
 it("el MISMO paciente a 2 240 m no tiene gradiente elevado (el defecto R03-08)",()=>{
  const cdmx=aaGradient(60,40,60,{fio2:0.21,atmPressure:585})!;
  expect(cdmx.alveolarPo2).toBe(63);
  expect(cdmx.elevated).toBe(false);
 });
 it("la presión de la atmósfera estándar a 2 240 m (ISO 2533) es 578.7 mmHg, no 760",()=>{
  expect(atmPressureFromAltitude(2240)).toBe(578.7);
  expect(atmPressureFromAltitude(0)).toBe(760);
 });
});

describe("Ácido-base · Winters, Ann Intern Med 1967 · Henderson-Hasselbalch",()=>{
 it("Winters exacto: pCO₂ esperado = 1.5·HCO₃ + 8",()=>{
  expect(interpretAcidBase(7.30,26,12,{specimen:"ARTERIAL"})!.expectedPco2).toBe(26);
 });
 it("Henderson-Hasselbalch exacto (pK 6.1, solubilidad 0.0301)",()=>{
  expect(phFromGases(40,24)).toBe(7.4);
  expect(phFromGases(40,5)).toBe(6.718); // el panel imposible del anexo, que antes se clasificaba
 });
 it("brecha aniónica y corrección de Figge exactas",()=>{
  expect(anionGap(140,106,10)!.value).toBe(24);
  expect(anionGap(140,118,10,2.0)!.value).toBe(17);  // 12 + 2.5·(4−2.0)
  expect(anionGap(140,118,10,2.0)!.raw).toBe(12);
 });
 it("delta-delta exacto: ΔAG/ΔHCO₃",()=>{
  expect(interpretAcidBase(7.20,25,10,{specimen:"ARTERIAL",anionGap:24})!.deltaRatio).toBe(0.86); // 12/14
 });
});

describe("IMC y eAG · WHO 1995 · ADAG (Nathan DM et al., Diabetes Care 2008)",()=>{
 it("IMC exacto con unidades imperiales declaradas (154 lb, 67 in)",()=>{
  expect(bmiFromVitals({value:"154",unit:"lb"},{value:"67",unit:"in"})!.bmi).toBe(24.1);
 });
 it("eAG exacto: 28.7·A1c − 46.7",()=>{
  expect(estimatedAverageGlucose(7)).toBe(154);
  expect(estimatedAverageGlucose(6)).toBe(126);
 });
 it("UNIDAD EQUIVOCADA: HbA1c en mmol/mol (IFCC) capturada como % se rechaza",()=>{
  expect(estimatedAverageGlucose(53)).toBeUndefined(); // 53 mmol/mol ≡ 7.0 %
 });
});

describe("NEWS2 · Royal College of Physicians 2017",()=>{
 it("un paciente estable con los siete parámetros suma 0 y la banda es LOW",()=>{
  const r=computeNEWS2({resp:16,spo2:98,temp:36.8,hr:72,sbp:120,supplementalO2:false,spo2Scale:1,consciousness:"A"});
  expect(r.score).toBe(0);expect(r.band).toBe("LOW");expect(r.complete).toBe(true);
 });
 it("con parámetros FALTANTES la banda NO es LOW (el defecto R03-13)",()=>{
  // El test anterior comprobaba `missing` y `score===0` y deliberadamente NO comprobaba `band`.
  const r=computeNEWS2({resp:16,spo2:98});
  expect(r.complete).toBe(false);
  expect(r.band).toBe("INCOMPLETE");
  expect(r.scoreIsLowerBound).toBe(true);
  expect(r.escalation).toBe(true);
 });
 it("el O₂ suplementario vale 2 puntos y la escala 2 cambia la lectura de la SpO₂",()=>{
  const conO2=computeNEWS2({resp:16,spo2:98,temp:36.8,hr:72,sbp:120,supplementalO2:true,spo2Scale:1,consciousness:"A"});
  expect(conO2.score).toBe(2);
  const escala2=computeNEWS2({resp:16,spo2:98,temp:36.8,hr:72,sbp:120,supplementalO2:true,spo2Scale:2,consciousness:"A"});
  expect(escala2.params["spo2"]).toBe(3); // hiperoxia con O₂ en escala 2
 });
});

describe("conversión de unidades de laboratorio · factores estándar de química clínica",()=>{
 it("los factores son los publicados, no aproximaciones",()=>{
  const creat=normalizeLabValue("CREATININE",88.4,"µmol/L");
  expect(creat.ok&&creat.canonicalValue).toBe(1);        // /88.4
  const glu=normalizeLabValue("GLUCOSE",5.5,"mmol/L");
  expect(glu.ok&&glu.canonicalValue).toBe(99.088);       // ×18.016
  const bili=normalizeLabValue("BILIRUBIN",342,"µmol/L");
  expect(bili.ok&&Math.round((bili.canonicalValue)*10)/10).toBe(20);  // /17.104
  const hb=normalizeLabValue("HEMOGLOBIN",140,"g/L");
  expect(hb.ok&&hb.canonicalValue).toBe(14);             // ×0.1
 });
 it("una unidad no reconocida se RECHAZA (nunca se asume la canónica)",()=>{
  const m=normalizeLabValue("CREATININE",1.0,"mg/L");
  expect(m.ok).toBe(false);
  if(!m.ok)expect(m.reason).toBe("UNKNOWN_UNIT");
 });
});

// R03-20/21/22 (cierre): las cotas y coberturas que cada paquete declara ahora.
describe("cotas y coberturas declaradas",()=>{
 it("FIB-4 declara su rango plausible y sus dos cortes",async()=>{
  const{FIB4_PLAUSIBLE,FIB4_LOW_CUTOFF,FIB4_HIGH_CUTOFF}=await import("../../packages/liver-fibrosis/src");
  expect(FIB4_PLAUSIBLE).toEqual([0.1,100]);
  expect(FIB4_LOW_CUTOFF).toEqual({standard:1.3,age65plus:2.0});
  expect(FIB4_HIGH_CUTOFF).toBe(2.67);
 });
 it("las 17 categorías de Charlson son ALCANZABLES con el catálogo CIE-10 del repositorio",async()=>{
  // Era el defecto R03-22: el índice estaba completo y 9 categorías —incluidas las dos de peso 6— no tenían ningún
  // código registrable, así que no podían cumplirse nunca.
  const{CHARLSON_ICD10,charlsonConditionsFromIcd10}=await import("../../packages/comorbidity/src");
  const{searchIcd10}=await import("../../packages/terminology/src");
  const catalogo=[...new Set("abcdefghijklmnopqrstuvwxyz".split("").flatMap(l=>searchIcd10(l,1000)).map(e=>e.code))];
  const presentes=charlsonConditionsFromIcd10(catalogo) as Record<string,boolean>;
  const inalcanzables=Object.keys(CHARLSON_ICD10).filter(k=>!presentes[k]);
  expect(inalcanzables,"categorías de Charlson que ningún código del catálogo puede activar").toEqual([]);
 });
 it("MELD-Na declara la cota del sodio de la política de UNOS",async()=>{
  const{MELD_NA_SODIUM_BOUNDS}=await import("../../packages/meld/src");
  expect(MELD_NA_SODIUM_BOUNDS).toEqual([125,137]);
 });
});

// R03-37 / vacío F12: el recibo de cálculo (algoritmo, versión, autoridad y HASH de las entradas) en las 11 rutas
// calculadoras, y la retirada de los dos paquetes-fachada cuyas promesas ya cumplen los paquetes reales.
describe("recibo de cálculo en las rutas calculadoras (R03-37)",()=>{
 const RUTAS=["fib4","egfr","cha2ds2vasc","meld","charlson","aa-gradient","acid-base","curb65","bmi","bp-stage","news2"];
 it("todas declaran algoritmo con versión Y devuelven recibo con hash de entradas",async()=>{
  const fs=await import("node:fs");
  for(const r of RUTAS){
   const src=fs.readFileSync(`apps/web/app/api/v1/patients/[patientId]/${r}/route.ts`,"utf8");
   expect(src,`${r}: sin recibo de cálculo`).toContain("calcReceipt(");
   expect(src,`${r}: sin versión de algoritmo`).toMatch(/version:"?\w/);
   expect(src,`${r}: sin autoridad clínica citada`).toContain("authority");
  }
 });
 it("el recibo ata el resultado a las entradas: dos entradas distintas, dos hashes distintos",async()=>{
  const{calcReceipt}=await import("../../apps/web/lib/calc-receipt");
  const alg={id:"X",version:"1"};
  const a=calcReceipt(alg,{creatinina:1.0,edad:50},"COMPUTED",91.7);
  const b=calcReceipt(alg,{creatinina:1.1,edad:50},"COMPUTED",82.5);
  expect(a.inputHash).not.toBe(b.inputHash);
  expect(a.inputHash).toHaveLength(64);
  // Mismas entradas en otro orden = mismo hash (canónico), que es lo que lo hace reproducible.
  expect(calcReceipt(alg,{edad:50,creatinina:1.0},"COMPUTED",91.7).inputHash).toBe(a.inputHash);
 });
 it("un cálculo NO computable también deja recibo, con su estado",async()=>{
  const{calcReceipt}=await import("../../apps/web/lib/calc-receipt");
  const r=calcReceipt({id:"X",version:"1"},{a:1},"INSUFFICIENT_DATA");
  expect(r.status).toBe("INSUFFICIENT_DATA");
  expect(r.value).toBeUndefined();
  expect(r.inputHash).toHaveLength(64);
 });
 it("los dos paquetes-fachada están retirados y declarados como tal",async()=>{
  const fs=await import("node:fs");
  for(const p of["packages/calculation-engine","packages/clinical-numeric"])
   expect(fs.existsSync(p),`${p} debería estar retirado`).toBe(false);
  const retired=(JSON.parse(fs.readFileSync("docs/adjudication/retired-paths.json","utf8")) as {retired:{path:string;reason:string}[]}).retired;
  for(const p of["packages/calculation-engine","packages/clinical-numeric"]){
   const fila=retired.find(x=>x.path===p);
   expect(fila,`${p} sin fila en retired-paths.json`).toBeDefined();
   expect(fila!.reason.length).toBeGreaterThan(40);
  }
 });
});

// Vectores del bloque 3 del anexo cerrados en el lote 11h: F02 (escalones CHEST del INR), F05 (brecha osmolal),
// F06 (límites de validez del calcio corregido), F07 (el INR no monitoriza ACOD) y F09 (ventana del delta check).
describe("INR: escalones de conducta y dominio (R03-F02, F07)",()=>{
 it("F02: un INR de 12 NO recibe el mismo texto que uno de 5",async()=>{
  const{interpretINR}=await import("../../packages/anticoagulation/src");
  const cinco=interpretINR(5)!,doce=interpretINR(12)!;
  expect(cinco.action).toBe("OMITIR_DOSIS_Y_RECONTROLAR");
  expect(doce.action).toBe("VITAMINA_K_ORAL");
  expect(cinco.interpretation).not.toBe(doce.interpretation);
  expect(cinco.interpretation).toMatch(/vitamina K de rutina NO está indicada/);
  expect(doce.interpretation).toMatch(/vitamina K 2\.5–5 mg ORAL/);
 });
 it("F02: con sangrado mayor se revierte a cualquier INR",async()=>{
  const{interpretINR}=await import("../../packages/anticoagulation/src");
  const r=interpretINR(3,{majorBleeding:true})!;
  expect(r.action).toBe("PCC_MAS_VITAMINA_K_IV");
  expect(r.status).toBe("CRITICAL_HIGH");
 });
 it("F07: el INR no monitoriza a un ACOD, y se dice explícitamente",async()=>{
  const{interpretINR}=await import("../../packages/anticoagulation/src");
  const r=interpretINR(2.5,{anticoagulant:"DOAC"})!;
  expect(r.applicable).toBe(false);
  expect(r.interpretation).toMatch(/NO monitoriza/);
  expect(interpretINR(2.5,{anticoagulant:"VKA"})!.applicable).toBe(true);
 });
 it("F07: el rango objetivo sale de la INDICACIÓN (válvula mecánica 2.5–3.5)",async()=>{
  const{interpretINR,INR_TARGETS}=await import("../../packages/anticoagulation/src");
  expect(INR_TARGETS.MECHANICAL_VALVE).toEqual({low:2.5,high:3.5});
  const valvula=interpretINR(2.2,{indication:"MECHANICAL_VALVE"})!;
  expect(valvula.status).toBe("SUBTHERAPEUTIC");         // 2.2 es terapéutico en FA y bajo con válvula
  expect(interpretINR(2.2,{indication:"AF_OR_VTE"})!.status).toBe("THERAPEUTIC");
 });
});

describe("brecha osmolal, calcio corregido y ventana del delta (R03-F05, F06, F09)",()=>{
 it("F05: la brecha osmolal delata el osmol no medido (valor exacto)",async()=>{
  const{osmolalGap,OSMOLAL_GAP_THRESHOLD}=await import("../../packages/lab-derivations/src");
  // Calculada = 2·140 + 100/18 + 14/2.8 = 290.6; medida 320 -> brecha 29.4
  const r=osmolalGap(140,100,14,320)!;
  expect(r.calculated).toBe(290.6);
  expect(r.gap).toBe(29.4);
  expect(r.elevated).toBe(true);
  expect(r.interpretation).toMatch(/metanol/);
  expect(OSMOLAL_GAP_THRESHOLD).toBe(10);
  // Con etanol medido, el osmol conocido se descuenta: 100 mg/dL ÷ 3.7 = 27.03
  const conEtanol=osmolalGap(140,100,14,320,100)!;
  expect(conEtanol.ethanolAccounted).toBe(true);
  expect(conEtanol.gap).toBeLessThan(r.gap);
  expect(conEtanol.elevated).toBe(false);
 });
 it("F06: el calcio corregido declara cuándo NO es fiable",async()=>{
  const{correctedCalcium,CALCIUM_CORRECTION_ALBUMIN_RANGE}=await import("../../packages/lab-derivations/src");
  expect(CALCIUM_CORRECTION_ALBUMIN_RANGE).toEqual([2.0,5.0]);
  const normal=correctedCalcium(7.5,3.0)!;
  expect(normal.reliable).toBe(true);
  expect(normal.corrected).toBe(8.3);
  // El caso del anexo: albúmina 0.5 g/dL se aceptaba sin objeción y «corregía» el calcio a 10.3 («normal»).
  const extrema=correctedCalcium(7.5,0.5)!;
  expect(extrema.reliable).toBe(false);
  expect(extrema.status).toBe("UNKNOWN");
  expect(extrema.interpretation).toMatch(/CALCIO IÓNICO/);
  // En ERC la fórmula tampoco es fiable, aunque la albúmina esté en rango.
  const erc=correctedCalcium(7.5,3.0,{ckd:true})!;
  expect(erc.reliable).toBe(false);
  expect(erc.interpretation).toMatch(/enfermedad renal crónica/);
 });
 it("F09: un «delta» de tres años no es un cambio agudo",async()=>{
  const{deltaCheck,DELTA_WINDOW_DAYS}=await import("../../packages/lab-reference/src");
  expect(DELTA_WINDOW_DAYS["CREATININE"]).toBe(7);
  // Dentro de la ventana: creatinina que se duplica en 3 días es lesión renal aguda.
  const agudo=deltaCheck("CREATININE","1.0","2.2",{priorAt:"2026-09-16T00:00:00Z",newAt:"2026-09-19T00:00:00Z"});
  expect(agudo.flagged).toBe(true);
  expect(agudo.severity).toBe("CRITICAL");
  // Fuera de la ventana: el mismo cambio en tres años es la progresión de una ERC, no una alerta.
  const cronico=deltaCheck("CREATININE","1.0","2.2",{priorAt:"2023-09-19T00:00:00Z",newAt:"2026-09-19T00:00:00Z"});
  expect(cronico.flagged).toBe(false);
  expect(cronico.outOfWindow).toBe(true);
  expect(cronico.note).toMatch(/fuera de la ventana/);
  // Sin fechas se mantiene el comportamiento anterior (no se puede saber).
  expect(deltaCheck("CREATININE","1.0","2.2").flagged).toBe(true);
 });
});
