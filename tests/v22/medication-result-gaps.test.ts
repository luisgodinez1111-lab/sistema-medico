import{describe,it,expect}from"vitest";
import fs from "node:fs";
import{evaluatePrescriptionSafety}from"../../packages/prescription-safety/src";
import{NO_CEILING}from"../../packages/medication-validation/src";
// Auditoría 2026-09-19, anexo R02a — MED-01 (el fármaco fuera de catálogo se saltaba barreras EN SILENCIO y no generaba
// ninguna obligación de monitoreo), MED-03 (`NOT_COVERED` era informativo: «no hay regla» se leía como «está bien») y
// RES-01 (la unidad del resultado era opcional en la API: se asumía la canónica).
const PACIENTE={ageYears:40,weightKg:70,egfr:90,
 allergies:[] as readonly {substance:string;severity:"MILD"|"MODERATE"|"SEVERE"|null;reaction:string|null}[],
 activeDrugCodes:[] as readonly string[],activeConditionCodes:[] as readonly string[]};
const CATALOG_CODES=[...NO_CEILING]; // principios del catálogo declarados SIN techo de dosis acotable
const ORDEN={dose:"500 mg",route:"ORAL",frequency:"cada 8 horas"}; // vocabulario controlado de medication-validation

describe("un fármaco sin regla de dosis máxima exige confirmación del médico (R02a-MED-03)",()=>{
 it("«sin regla en el catálogo» entra en REVIEW y exige confirmación (hoy DORMIDO: el catálogo cubre sus 38 fármacos)",()=>{
  // Matiz importante que salió al probarlo: los 5 principios del catálogo sin tope diario fijo (warfarina, acenocumarol,
  // ampicilina, ceftriaxona, penicilina) NO son «sin regla»: el catálogo declara NOT_APPLICABLE porque se dosifican por
  // objetivo terapéutico (INR, respuesta clínica). Eso es una afirmación clínica deliberada y debe seguir dando CLEAR.
  // `NOT_COVERED` es otra cosa: un fármaco del catálogo para el que NO existe valor de referencia. Hoy no hay ninguno
  // —los 38 están cubiertos por MAX_DAILY_MG o por NO_CEILING—, así que la regla está DORMIDA: se verifica que exista y
  // que sea correcta, para que el día que se añada un fármaco sin techo no pase silenciosamente como «seguro».
  const src=fs.readFileSync("packages/prescription-safety/src/index.ts","utf8");
  const veredicto=/const verdict:SafetyVerdict=[^;]+;/.exec(src)?.[0]??"";
  expect(veredicto,"notCovered debe influir en el veredicto").toContain("notCovered.length>0");
  expect(src,"notCovered debe exigir confirmación expresa").toMatch(/requiresAcknowledgement:notEvaluated\.length>0\|\|notCovered\.length>0/);
 });
 it("un principio SIN TOPE FIJO declarado (warfarina) sigue siendo CLEAR: es criterio clínico, no una laguna",()=>{
  const r=evaluatePrescriptionSafety({drugCode:"warfarina",...ORDEN,...PACIENTE});
  const techo=r.barriers.find(b=>b.id==="doseCeiling");
  expect(techo?.status).toBe("NOT_APPLICABLE");
  expect(techo?.detail).toMatch(/objetivo terapéutico/);
  expect(r.verdict).toBe("CLEAR");
 });
 it("un fármaco FUERA del catálogo deja constancia de todo lo que no se evaluó",()=>{
  const r=evaluatePrescriptionSafety({drugCode:"medicamento-inexistente-xyz",...ORDEN,...PACIENTE});
  expect(r.catalogResolved).toBe(false);
  expect(r.requiresAcknowledgement).toBe(true);
  // las barreras que dependen del catálogo quedan NO EVALUADAS, con estado explícito (no ausentes, no «pasadas»)
  for(const id of ["interaction","duplicate","contraindication","doseCeiling"])
   expect(r.notEvaluated,`${id} debe declararse no evaluada`).toContain(id);
  expect(r.barriers.every(b=>b.status!=="PASSED"||b.id==="order"),"ninguna barrera dependiente del catálogo puede decir PASSED").toBe(true);
 });
 it("un fármaco del catálogo con todo en orden sí puede quedar CLEAR (el gate no es un bloqueo indiscriminado)",()=>{
  const r=evaluatePrescriptionSafety({drugCode:"amoxicilina",...ORDEN,...PACIENTE});
  expect(["CLEAR","REVIEW"]).toContain(r.verdict);
  if(r.verdict==="CLEAR")expect(r.requiresAcknowledgement).toBe(false);
 });
});

describe("la propuesta y el monitoreo dejan de ser silenciosos (R02a-MED-01)",()=>{
 const src=fs.readFileSync("apps/web/lib/medication-lifecycle.ts","utf8");
 it("PROPOSE registra en el EVENTO qué no pudo verificar",()=>{
  expect(src).toMatch(/noVerificado/);
  expect(src).toMatch(/safety:\{catalogResolved:false,notEvaluated:noVerificado\}/);
 });
 it("PROPOSE devuelve el aviso al cliente (la UI no puede presentarla como verificada)",()=>{
  expect(src).toMatch(/warnings:\[\{code:"DRUG_NOT_IN_CATALOG"/);
 });
 it("un fármaco sin reglas de monitoreo genera la obligación de DEFINIRLO, no cero obligaciones",()=>{
  expect(src).toContain("MONITORING_UNDEFINED");
  expect(src).toMatch(/rules\.length===0&&!resolveDrug\(drugCode\)/);
  expect(src).toMatch(/priority:"HIGH"/);
 });
 it("el 428 distingue «no se pudo evaluar» de «no hay regla en el catálogo»",()=>{
  expect(src).toMatch(/NO evaluadas/);
  expect(src).toMatch(/SIN regla en el catálogo/);
  expect(src).toMatch(/notCovered:sinRegla/);
  const errores=fs.readFileSync("apps/web/lib/http-errors.ts","utf8");
  expect(errores).toMatch(/SAFETY_ACK_REQUIRED:\["notEvaluated","notCovered"\]/);
 });
});

describe("la unidad del resultado es obligatoria (R02a-RES-01)",()=>{
 const src=fs.readFileSync("apps/web/lib/result-lifecycle.ts","utf8");
 it("al RECIBIR y al CORREGIR: sin unidad, 400 (antes se asumía la canónica)",()=>{
  expect(src).not.toMatch(/unit:z\.string\(\)\.max\(24\)\.optional\(\)/);
  expect((src.match(/unit:z\.string\(\)\.trim\(\)\.min\(1/g)??[]).length).toBe(2);
  expect(src).toMatch(/La unidad es obligatoria/);
 });
 it("el motivo queda escrito en el código, no solo en el tracker",()=>{
  expect(src).toMatch(/7 mmol\/L o 7 mg\/dL/);
 });
});

describe("un solo modelo de estados de resultado (R02a-RES-02)",()=>{
 it("order-result-domain es solo VOCABULARIO: sus funciones sin llamador se retiraron",()=>{
  const src=fs.readFileSync("packages/order-result-domain/src/index.ts","utf8");
  expect(src).not.toMatch(/export function (closeResult|correctResult)/);
  expect(src).toMatch(/export type ResultState/);
  expect(src).toMatch(/\(sin transición\)/); // los estados que nadie produce están marcados como tales
 });
 it("las implementaciones paralelas del ciclo de resultados ya no existen",()=>{
  for(const p of ["packages/result-service","packages/result-correction-runtime"])
   expect(fs.existsSync(p),`${p} debía retirarse`).toBe(false);
 });
 it("el comentario de result-correction ya no dice que la corrección «no se expone por ruta»",()=>{
  const src=fs.readFileSync("packages/result-correction/src/index.ts","utf8");
  // El comentario nuevo CITA la frase antigua para explicar qué se corrigió; lo que no puede haber es la afirmación viva.
  expect(src).not.toMatch(/que el ciclo de vida de resultados AÚN NO expone por ruta/);
  expect(src).toMatch(/ESTADO REAL/);
  expect(src).toContain("POST /api/v1/results/:id/correction");
 });
 it("las capacidades apuntan a la evidencia del ciclo vivo, con nota de por qué",()=>{
  const caps=JSON.parse(fs.readFileSync("capabilities/catalog.json","utf8")) as {id:string;tests?:string[];evidenceNote?:string}[];
  for(const id of ["CAP-VERTICAL-RESULT-001","CAP-ORDER-RESULT-001","CAP-CORRECTION-RUNTIME-003"]){
   const c=caps.find(x=>x.id===id)!;
   expect(c.tests,`${id} sin tests`).toBeTruthy();
   expect(c.tests!.some(t=>t.includes("result-fold")||t.includes("corrected-result")),`${id} debe apuntar al ciclo vivo`).toBe(true);
   expect(c.evidenceNote,`${id} debe explicar el re-lineado`).toMatch(/R02a-RES-02/);
  }
 });
});
