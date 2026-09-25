import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{dialysisAdequacy,KTV_FORMULA,KTV_TARGET_THRICE_WEEKLY,URR_TARGET_PERCENT,UF_RATE_REFERENCE_ML_KG_H,
 DIALYSIS_ADEQUACY_LIMITS,type SessionMeasurements}from"../../packages/dialysis-adequacy/src";
// Auditoría 2026-09-19, anexo R02b (R2B-020) — NIVEL 0/5: NI UNA VARIABLE DE TERAPIA DE REEMPLAZO RENAL.
//
// El ciclo de vida de diálisis tenía DOS campos clínicos en todo el archivo (`modality` y `accessType`, los dos solo al
// agendar). Sin Kt/V, sin peso seco, sin pesos pre y post, sin ultrafiltración, sin presión intra-sesión y sin duración
// prescrita frente a la real. El anexo lo llamó «literalmente un cronómetro de cuatro estados».
//
// Los números de estos casos se calculan a mano con la fórmula publicada para que la prueba compruebe LA FÓRMULA, no lo que
// el código devuelve. spKt/V = −ln(R − 0.008·t) + (4 − 3.5·R)·ΔBW/BW_post.
const BASE:SessionMeasurements={durationMinutes:240,prescribedMinutes:240,preWeightKg:73.4,postWeightKg:70.2,
 dryWeightKg:70,preUreaMgDl:120,postUreaMgDl:32};

describe("Kt/V por Daugirdas de 2.ª generación (R2B-020)",()=>{
 it("una sesión adecuada: R=0.267, t=4 h, ΔBW=3.2 kg → spKt/V ≈ 1.59",()=>{
  // Comprobación manual: R=32/120=0.26667; R−0.008·4=0.23467; −ln(0.23467)=1.4497;
  // (4−3.5·0.26667)=3.0667; ΔBW/BW_post=3.2/70.2=0.04558; 3.0667·0.04558=0.13979; total ≈ 1.5895 → 1.59.
  const r=dialysisAdequacy(BASE);
  expect(r.spKtV).toBe(1.59);
  expect(r.formula).toBe(KTV_FORMULA);
  expect(r.warnings.join(" "),"1.59 supera el objetivo, no debe avisar de Kt/V bajo").not.toMatch(/KTV_BAJO/);
 });
 it("la URR se reporta junto al Kt/V porque muchas unidades siguen usándola",()=>{
  expect(dialysisAdequacy(BASE).urrPercent).toBe(73.3);
  expect(URR_TARGET_PERCENT).toBe(65);
 });
 it("una sesión INSUFICIENTE se nombra, con el objetivo de la guía citado",()=>{
  const r=dialysisAdequacy({...BASE,durationMinutes:120,prescribedMinutes:240,postUreaMgDl:78,postWeightKg:70});
  expect(r.spKtV).not.toBeNull();
  expect(r.spKtV!).toBeLessThan(KTV_TARGET_THRICE_WEEKLY);
  expect(r.warnings.join(" ")).toMatch(/KTV_BAJO/);
  expect(r.warnings.join(" "),"el objetivo tiene dueño: KDOQI").toMatch(/KDOQI/);
 });
 it("SIN UREA NO HAY Kt/V: no se estima ni se sustituye por un valor por omisión",()=>{
  // Es la diferencia entre «no se midió» y «salió bajo». Inventar un Kt/V sería peor que no tenerlo.
  const r=dialysisAdequacy({durationMinutes:240,prescribedMinutes:240,preWeightKg:73,postWeightKg:70,dryWeightKg:70});
  expect(r.spKtV).toBeNull();
  expect(r.urrPercent).toBeNull();
  expect(r.missing).toContain("preUreaMgDl");
  expect(r.missing).toContain("postUreaMgDl");
 });
 it("una urea post desproporcionada no devuelve NaN: se dice que la fórmula no aplica",()=>{
  // `R − 0.008·t` tiene que ser positivo para el logaritmo. Devolver NaN sería un número que parece un resultado.
  const r=dialysisAdequacy({...BASE,preUreaMgDl:120,postUreaMgDl:1,durationMinutes:600});
  expect(r.spKtV).toBeNull();
  expect(r.warnings.join(" ")).toMatch(/KTV_FUERA_DE_DOMINIO/);
 });
 it("valores no positivos no se evalúan",()=>{
  const r=dialysisAdequacy({...BASE,preUreaMgDl:0,postUreaMgDl:0});
  expect(r.spKtV).toBeNull();
  expect(r.warnings.join(" ")).toMatch(/KTV_NO_CALCULABLE/);
 });
});

describe("ultrafiltración y peso seco (R2B-020)",()=>{
 it("el volumen sale de los pesos y la tasa se normaliza por peso y hora",()=>{
  const r=dialysisAdequacy(BASE);
  expect(r.ultrafiltrationL).toBeCloseTo(3.2,3);
  // 3.2 L = 3200 mL; 3200/70.2 kg/4 h = 11.4 mL/kg/h.
  expect(r.ultrafiltrationRateMlKgH).toBe(11.4);
 });
 it("UNA TASA ALTA SE AVISA: es el número asociado a la hipotensión intradiálisis",()=>{
  // 5 kg en 2 h sobre 60 kg = 41.7 mL/kg/h.
  const r=dialysisAdequacy({...BASE,preWeightKg:65,postWeightKg:60,durationMinutes:120,prescribedMinutes:120,dryWeightKg:60});
  expect(r.ultrafiltrationRateMlKgH!).toBeGreaterThan(UF_RATE_REFERENCE_ML_KG_H);
  expect(r.warnings.join(" ")).toMatch(/UF_RATE_ALTA/);
  expect(r.warnings.join(" "),"el aviso debe decir contra qué límite se comparó").toMatch(/límite declarado/);
 });
 it("el límite de la tasa es una REFERENCIA que el establecimiento puede declarar",()=>{
  // No se le atribuye a ninguna guía: el corte más citado viene de estudios observacionales, y convertirlo en regla del
  // sistema es una decisión clínica, no de ingeniería.
  const r=dialysisAdequacy(BASE,{ufRateLimitMlKgH:10});
  expect(r.warnings.join(" "),"con un límite más estricto, 11.4 sí avisa").toMatch(/UF_RATE_ALTA/);
  expect(DIALYSIS_ADEQUACY_LIMITS).toMatch(/observacionales/);
 });
 it("sin peso seco no se afirma que el paciente quedó bien: se declara faltante",()=>{
  // Asumir que el peso post ES el seco convierte una sobrecarga en un «objetivo alcanzado».
  // `exactOptionalPropertyTypes`: la clave se OMITE, no se pone en `undefined`. Es la diferencia entre «no se midió» y «se
  // midió y vale undefined», y el tipo del paquete solo admite la primera.
  const{dryWeightKg:_omitido,...sinSeco}=BASE;void _omitido;
  const r=dialysisAdequacy(sinSeco);
  expect(r.deltaFromDryWeightKg).toBeNull();
  expect(r.missing).toContain("dryWeightKg");
 });
 it("quedar por encima o por debajo del peso seco se nombra, con su riesgo",()=>{
  expect(dialysisAdequacy({...BASE,postWeightKg:72,dryWeightKg:70}).warnings.join(" ")).toMatch(/SOBRE_PESO_SECO/);
  const bajo=dialysisAdequacy({...BASE,postWeightKg:68,dryWeightKg:70});
  expect(bajo.warnings.join(" ")).toMatch(/BAJO_PESO_SECO/);
  expect(bajo.warnings.join(" "),"por debajo del seco el riesgo es la hipotensión").toMatch(/hipotensión/);
 });
});

describe("duración: cumplir el tiempo es parte de la dosis (R2B-020)",()=>{
 it("el déficit se calcula y se avisa aunque el Kt/V salga suficiente",()=>{
  const r=dialysisAdequacy({...BASE,durationMinutes:180,prescribedMinutes:240});
  expect(r.shortfallMinutes).toBe(60);
  expect(r.warnings.join(" ")).toMatch(/SESION_ACORTADA/);
 });
 it("cumplir o superar el tiempo no genera déficit",()=>{
  expect(dialysisAdequacy(BASE).shortfallMinutes).toBe(0);
  expect(dialysisAdequacy({...BASE,durationMinutes:260}).shortfallMinutes).toBe(0);
 });
});

describe("el hallazgo no puede volver (R2B-020)",()=>{
 const src=fs.readFileSync("apps/web/lib/dialysis-lifecycle.ts","utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
 it("agendar prescribe tiempo, iniciar pesa y completar mide y calcula",()=>{
  expect(src).toMatch(/prescribedMinutes:z\.number\(\)/);
  expect(src).toMatch(/preWeightKg:z\.number\(\)/);
  expect(src).toMatch(/postWeightKg:z\.number\(\)/);
  expect(src,"la adecuación se calcula en el cierre").toMatch(/dialysisAdequacy\(\{/);
  expect(src,"y el evento cita la fórmula aplicada").toMatch(/ktvFormula:KTV_FORMULA/);
 });
 it("lo prescrito y el peso pre se leen del STREAM, no del cuerpo de la petición",()=>{
  // Si vinieran del cuerpo, quien cierra la sesión podría declarar una prescripción a medida de lo que hizo, y «cumplió lo
  // prescrito» dejaría de significar algo.
  expect(src).toMatch(/readAggregateEvents\(ctx,dialysisId\)/);
  expect(src).toMatch(/agendado\["prescribedMinutes"\]/);
  expect(src).toMatch(/iniciado\["preWeightKg"\]/);
 });
 it("la interrupción tiene CAUSA estructurada, no solo un texto libre",()=>{
  // Con el motivo en prosa no se puede contar cuántas sesiones se interrumpieron por hipotensión ni relacionarlo con la UF.
  expect(src).toMatch(/INTERRUPTION_CAUSES/);
  expect(src).toMatch(/cause:z\.enum\(INTERRUPTION_CAUSES\)/);
  expect(src,"y la presión que la sostiene o la descarta").toMatch(/systolic:z\.number\(\)/);
 });
 it("el módulo declara lo que NO cubre, empezando por la diálisis peritoneal",()=>{
  expect(DIALYSIS_ADEQUACY_LIMITS).toMatch(/peritoneal/i);
  expect(DIALYSIS_ADEQUACY_LIMITS).toMatch(/pediátrica/);
  expect(DIALYSIS_ADEQUACY_LIMITS).toMatch(/ADR-0300/);
 });
});
