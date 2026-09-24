import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{normalizeVitalMeasure,canonicalVitalUnit,vitalUnitAccepted,VITAL_UNITS}from"../../packages/lab-reference/src";
import{verifyVitalReadings,MAX_VITAL_AGE_HOURS,vitalLabel}from"../../apps/web/lib/vital-inputs";
import{bmiFromVitals,BMI_PLAUSIBLE,BMI_MIN_ADULT_AGE_YEARS}from"../../packages/anthropometrics/src";
import{stageBloodPressure,parseBp}from"../../packages/bp-staging/src";
import type{VitalReading}from"../../apps/web/lib/clinical-runtime";
// Auditoría 2026-09-19, anexo R03 — R03-09 (el IMC infería la unidad por la magnitud del número), R03-11
// (`latestVitalsByType` no devolvía unidad ni fecha, ignoraba las enmiendas y contaba las tomas anuladas) y
// R03-16 (`bp-staging` estadificaba «80/120» como hipertensión estadio 2).
const NOW=new Date("2026-09-24T12:00:00.000Z");
const hace=(h:number):string=>new Date(NOW.getTime()-h*3_600_000).toISOString();
const lectura=(o:Partial<VitalReading>&{vitalType:string;value:string}):VitalReading=>
 ({unit:null,canonicalUnit:null,unitAssumed:false,occurredAt:hace(1),amended:false,vitalId:"v1",...o});

describe("unidad canónica de los signos vitales (R03-09)",()=>{
 it("cada tipo declara su unidad canónica",()=>{
  expect(canonicalVitalUnit("WEIGHT")).toBe("kg");expect(canonicalVitalUnit("HEIGHT")).toBe("cm");
  expect(canonicalVitalUnit("TEMP")).toBe("°C");expect(canonicalVitalUnit("BP")).toBe("mmHg");
  expect(canonicalVitalUnit("NO_EXISTE")).toBeUndefined();
  expect(Object.keys(VITAL_UNITS).sort()).toEqual(["BP","HEIGHT","HR","RESP","SPO2","TEMP","WEIGHT"]);
 });
 it("las libras se convierten a kilogramos (el defecto que daba «obesidad clase III» a un IMC de 21)",()=>{
  const m=normalizeVitalMeasure("WEIGHT","154","lb");
  expect(m.ok).toBe(true);
  if(m.ok){expect(Number(m.canonicalValue)).toBeCloseTo(69.853,2);expect(m.canonicalUnit).toBe("kg");expect(m.converted).toBe(true);}
 });
 it("las pulgadas se convierten a centímetros y los gramos a kilogramos",()=>{
  const h=normalizeVitalMeasure("HEIGHT","67","in");expect(h.ok&&Number(h.canonicalValue)).toBeCloseTo(170.18,2);
  const g=normalizeVitalMeasure("WEIGHT","3500","g");expect(g.ok&&Number(g.canonicalValue)).toBe(3.5);
 });
 it("los °F se convierten con offset (98.6 °F = 37 °C), no con factor",()=>{
  const f=normalizeVitalMeasure("TEMP","98.6","F");expect(f.ok&&Number(f.canonicalValue)).toBe(37);
  // Antes, 98.6 caía fuera de la cota 25–45 y se rechazaba como implausible en vez de convertirse.
  expect(normalizeVitalMeasure("TEMP","37","C").ok).toBe(true);
 });
 it("una unidad no reconocida se rechaza (no se guarda «150» sin saber la escala)",()=>{
  const m=normalizeVitalMeasure("WEIGHT","150","u");
  expect(m.ok).toBe(false);
  if(!m.ok){expect(m.reason).toBe("UNKNOWN_UNIT");expect(m.message).toMatch(/Unidad no reconocida/);}
  expect(normalizeVitalMeasure("WEIGHT","150","").ok).toBe(false);
  expect(vitalUnitAccepted("WEIGHT","lb")).toBe(true);
  expect(vitalUnitAccepted("WEIGHT","u")).toBe(false);
 });
 it("la plausibilidad se evalúa DESPUÉS de convertir",()=>{
  // 700 kg es implausible; 700 g es un recién nacido prematuro real (0.7 kg).
  expect(normalizeVitalMeasure("WEIGHT","700","kg").ok).toBe(false);
  expect(normalizeVitalMeasure("WEIGHT","700","g").ok).toBe(true);
 });
 it("la presión mantiene el formato S/D y rechaza la inversión",()=>{
  const m=normalizeVitalMeasure("BP","120/80","mmHg");expect(m.ok&&m.canonicalValue).toBe("120/80");
  const bad=normalizeVitalMeasure("BP","80/120","mmHg");expect(bad.ok).toBe(false);
  if(!bad.ok)expect(bad.reason).toBe("IMPLAUSIBLE");
 });
 it("un tipo desconocido no pasa por la puerta",()=>{
  const m=normalizeVitalMeasure("GLUCOSA_CAPILAR","100","mg/dL");
  expect(m.ok).toBe(false);if(!m.ok)expect(m.reason).toBe("UNKNOWN_TYPE");
 });
});

describe("guarda de entradas de signos vitales (R03-11)",()=>{
 const spec=(t:string,h=MAX_VITAL_AGE_HOURS.ACUTE_ADMISSION)=>({vitalType:t,maxAgeHours:h});
 it("acepta tomas vigentes y devuelve el valor canónico con unidad y antigüedad",()=>{
  const r=verifyVitalReadings([spec("RESP")],{RESP:lectura({vitalType:"RESP",value:"18",canonicalUnit:"rpm",occurredAt:hace(2)})},{now:NOW});
  expect(r.ok).toBe(true);
  if(r.ok){expect(r.values["RESP"]).toBe("18");expect(r.inputs[0]!.unit).toBe("rpm");expect(r.inputs[0]!.ageHours).toBe(2);}
 });
 it("una toma OBSOLETA no alimenta una decisión aguda (y sí una antropométrica)",()=>{
  const readings={WEIGHT:lectura({vitalType:"WEIGHT",value:"70",canonicalUnit:"kg",occurredAt:hace(30)})};
  const agudo=verifyVitalReadings([spec("WEIGHT")],readings,{now:NOW});
  expect(agudo.ok).toBe(false);
  if(!agudo.ok){expect(agudo.stale).toHaveLength(1);expect(agudo.reason).toMatch(/obsoleto/i);}
  expect(verifyVitalReadings([spec("WEIGHT",MAX_VITAL_AGE_HOURS.ANTHROPOMETRY)],readings,{now:NOW}).ok).toBe(true);
 });
 it("un tipo ausente o vacío se declara faltante con su nombre clínico",()=>{
  const r=verifyVitalReadings([spec("BP")],{},{now:NOW});
  expect(r.ok).toBe(false);
  if(!r.ok){expect(r.missing).toEqual(["BP"]);expect(r.reason).toContain("presión arterial");}
  const vacio=verifyVitalReadings([spec("BP")],{BP:lectura({vitalType:"BP",value:""})},{now:NOW});
  expect(vacio.ok).toBe(false);
 });
 it("un valor implausible NO se convierte en un puntaje bajo: se declara no utilizable",()=>{
  const r=verifyVitalReadings([spec("RESP")],{RESP:lectura({vitalType:"RESP",value:"300",canonicalUnit:"rpm"})},{now:NOW});
  expect(r.ok).toBe(false);
  if(!r.ok){expect(r.implausible).toHaveLength(1);expect(r.stale).toHaveLength(0);}
 });
 it("una unidad ASUMIDA (evento anterior a la corrección) se declara en las advertencias",()=>{
  const r=verifyVitalReadings([spec("WEIGHT")],{WEIGHT:lectura({vitalType:"WEIGHT",value:"70",canonicalUnit:null,unitAssumed:true})},{now:NOW});
  expect(r.ok).toBe(true);
  if(r.ok)expect(r.warnings.some(w=>/asumió kg/.test(w))).toBe(true);
 });
 it("una ENMIENDA se usa y se declara (el valor rectificado, nunca el original)",()=>{
  const r=verifyVitalReadings([spec("RESP")],{RESP:lectura({vitalType:"RESP",value:"15",canonicalUnit:"rpm",amended:true})},{now:NOW});
  expect(r.ok).toBe(true);
  if(r.ok){expect(r.values["RESP"]).toBe("15");expect(r.warnings.some(w=>/ENMIENDA/.test(w))).toBe(true);}
 });
 it("varios motivos se acumulan en un solo «no computable»",()=>{
  const r=verifyVitalReadings([spec("RESP"),spec("BP"),spec("SPO2")],
   {RESP:lectura({vitalType:"RESP",value:"18",canonicalUnit:"rpm",occurredAt:hace(40)}),BP:lectura({vitalType:"BP",value:"80/120",canonicalUnit:"mmHg"})},{now:NOW});
  expect(r.ok).toBe(false);
  if(!r.ok){expect(r.missing).toEqual(["SPO2"]);expect(r.stale).toHaveLength(1);expect(r.implausible).toHaveLength(1);}
 });
 it("los nombres clínicos existen para todos los tipos capturables",()=>{
  for(const t of Object.keys(VITAL_UNITS))expect(vitalLabel(t),t).not.toBe(t);
 });
 it("la lectura del expediente excluye tomas anuladas y usa el último kind (guardián de la consulta SQL)",()=>{
  const src=fs.readFileSync("apps/web/lib/runtime/patient-facts.ts","utf8");
  const fn=/export async function latestVitalReadings[\s\S]*?\n}/.exec(src)?.[0]??"";
  expect(fn,"no se encontró latestVitalReadings").not.toBe("");
  expect(fn).toContain("l.payload->>'kind'<>'ENTERED_IN_ERROR'");
  expect(fn).toMatch(/order by c\.sequence desc limit 1/);          // el ÚLTIMO evento del agregado manda
  expect(fn).toContain("coalesce(l.payload->>'canonicalValue'");    // la enmienda gana, en unidad canónica
 });
 it("el ciclo de vida valida la unidad ANTES de clasificar y guarda el valor canónico",()=>{
  const src=fs.readFileSync("apps/web/lib/vital-lifecycle.ts","utf8");
  expect(src).toContain("normalizeVitalMeasure");
  expect(src).not.toMatch(/classifyVital\((?:b|folded)\.vitalType,b\.value/); // se clasifica el canónico, no el crudo
  expect(src.match(/canonicalValue:m\.canonicalValue/g)?.length).toBeGreaterThanOrEqual(2); // RECORDED y AMENDED
 });
});

describe("IMC: cotas y pediatría (R03-09)",()=>{
 it("las libras y las pulgadas dan el IMC correcto cuando la unidad se declara",()=>{
  const r=bmiFromVitals({value:"154",unit:"lb"},{value:"67",unit:"in"});
  expect(r).toBeDefined();expect(r!.bmi).toBeCloseTo(24.1,1);
 });
 it("las cotas de IMC humano están declaradas y el umbral de adulto es 19 años (OMS)",()=>{
  expect(BMI_PLAUSIBLE).toEqual([8,100]);
  expect(BMI_MIN_ADULT_AGE_YEARS).toBe(19);
  // 70 kg con 0.7 m (la talla de un lactante con el peso de un adulto) da 142.9: fuera de cota.
  expect(bmiFromVitals({value:"70",unit:"kg"},{value:"70",unit:"cm"})!.bmi).toBeGreaterThan(BMI_PLAUSIBLE[1]);
 });
});

describe("presión arterial invertida (R03-16)",()=>{
 it("80/120 no se estadifica (antes: «Hipertensión estadio 2»)",()=>{
  expect(stageBloodPressure(80,120)).toBeUndefined();
  expect(stageBloodPressure(120,120)).toBeUndefined();
  expect(stageBloodPressure(145,92)?.stage).toBe("STAGE_2");
 });
 it("parseBp sigue siendo un parser: devuelve lo escrito y no juzga",()=>{
  expect(parseBp("80/120")).toEqual({systolic:80,diastolic:120});
  expect(parseBp("no es presión")).toBeUndefined();
 });
});

// R03-09 (continuación): una unidad DECLARADA y desconocida invalida el cálculo; solo la ausencia de unidad se infiere.
describe("IMC: la unidad declarada no se adivina (R03-09)",()=>{
 it("una unidad de peso desconocida devuelve undefined en vez de tratar el número como kg",()=>{
  expect(bmiFromVitals({value:"150",unit:"u"},{value:"170",unit:"cm"})).toBeUndefined();
  expect(bmiFromVitals({value:"70",unit:"kg"},{value:"170",unit:"leguas"})).toBeUndefined();
 });
 it("sin unidad (eventos antiguos) se infiere por magnitud y se DECLARA como asumida",()=>{
  const r=bmiFromVitals({value:"70"},{value:"170"});
  expect(r).toBeDefined();expect(r!.heightUnitAssumed).toBe(true);expect(r!.heightM).toBe(1.7);
 });
 it("con unidad declarada nada queda asumido",()=>{
  expect(bmiFromVitals({value:"70",unit:"kg"},{value:"1.70",unit:"m"})!.heightUnitAssumed).toBe(false);
 });
});
