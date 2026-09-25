import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{nextDueDate,assertObligationTransition,obligationTemplate,OBLIGATION_CATALOG,PERIODICITIES,
 PERIODICITY_LABEL,REGULATORY_OBLIGATIONS_LIMITS}from"../../packages/regulatory-obligations/src";
// Auditoría 2026-09-19, anexo R02b (R2B-024) — CATEGORÍAS DE UN DESPLEGABLE, Y SOLO `CREATE`.
//
// Las «obligaciones regulatorias» eran seis categorías genéricas y `periodicity` era `z.string().min(1)`, así que «anual»,
// «cada año» y «asdf» valían lo mismo y no había nada que calcular. Y el archivo entero tenía UN handler: una vez creada, la
// obligación no se podía marcar cumplida, ni adjuntar evidencia, ni renovar. Un registro en el que nada se cumple solo crece.

describe("periodicidad estructurada y próximo vencimiento (R2B-024)",()=>{
 it("suma MESES de calendario, no 30 días",()=>{
  // Una obligación anual vence el mismo día del año siguiente; con un cálculo por días, los años bisiestos desplazan la
  // fecha y el vencimiento deja de coincidir con el trámite real.
  expect(nextDueDate("2026-01-31","ANUAL")).toBe("2027-01-31");
  expect(nextDueDate("2026-02-29","ANUAL")).toBe("2027-02-28"); // 2028 es bisiesto, 2027 no
  expect(nextDueDate("2026-03-15","MENSUAL")).toBe("2026-04-15");
  expect(nextDueDate("2026-11-30","BIMESTRAL")).toBe("2027-01-30");
  expect(nextDueDate("2026-06-01","SEMESTRAL")).toBe("2026-12-01");
  expect(nextDueDate("2026-06-01","BIENAL")).toBe("2028-06-01");
 });
 it("EL DESBORDAMIENTO DE DÍA se ancla al último día del mes destino",()=>{
  // `Date` por omisión convierte el 31 de enero + 1 mes en el 3 de marzo, que sería un vencimiento equivocado.
  expect(nextDueDate("2026-01-31","MENSUAL")).toBe("2026-02-28");
  expect(nextDueDate("2028-01-31","MENSUAL")).toBe("2028-02-29"); // bisiesto
  expect(nextDueDate("2026-05-31","MENSUAL")).toBe("2026-06-30");
 });
 it("una periodicidad que no define intervalo devuelve `null` en vez de adivinar",()=>{
  expect(nextDueDate("2026-01-31","UNICA")).toBeNull();
  expect(nextDueDate("2026-01-31","OTRA")).toBeNull();
 });
 it("una fecha mal formada falla en voz alta",()=>{
  expect(()=>nextDueDate("31/01/2026","ANUAL")).toThrow(/REGULATORY_DUE_DATE_INVALID/);
  expect(()=>nextDueDate("","ANUAL")).toThrow();
 });
 it("todas las periodicidades tienen etiqueta: ninguna queda sin nombre en la pantalla",()=>{
  for(const p of PERIODICITIES)expect(PERIODICITY_LABEL[p],p).toBeTruthy();
 });
});

describe("el ciclo de cumplimiento (R2B-024)",()=>{
 it("cumplir NO es terminal: una obligación periódica se renueva desde ahí",()=>{
  expect(()=>assertObligationTransition("OPEN","COMPLIED")).not.toThrow();
  expect(()=>assertObligationTransition("COMPLIED","OPEN")).not.toThrow();
 });
 it("cumplir dos veces, o renovar sin cumplir, son errores de secuencia",()=>{
  expect(()=>assertObligationTransition("COMPLIED","COMPLIED")).toThrow(/ILLEGAL_TRANSITION/);
  expect(()=>assertObligationTransition("OPEN","OPEN")).toThrow(/ILLEGAL_TRANSITION/);
 });
 it("una obligación exenta es terminal",()=>{
  expect(()=>assertObligationTransition("OPEN","WAIVED")).not.toThrow();
  expect(()=>assertObligationTransition("WAIVED","OPEN")).toThrow();
  expect(()=>assertObligationTransition("WAIVED","COMPLIED")).toThrow();
 });
});

describe("catálogo de obligaciones con nombre propio (R2B-024)",()=>{
 it("incluye las tres normas que el propio repositorio declara aplicables",()=>{
  // El hallazgo señalaba que NOM-004, NOM-024 y el aviso de privacidad existen en `docs/compliance/README.md` pero en una
  // capa sin conexión con el registro del consultorio.
  for(const code of["NOM-004-SSA3-2012","NOM-024-SSA3-2012","LFPDPPP-AVISO"])
   expect(obligationTemplate(code),code).toBeTruthy();
  const compliance=fs.readFileSync("docs/compliance/README.md","utf8");
  expect(compliance,"y siguen declaradas allí: las dos capas hablan de lo mismo").toMatch(/NOM-004-SSA3-2012/);
 });
 it("NINGUNA entrada atribuye a una norma un plazo que no puede citar",()=>{
  // Es la regla que evita inventar periodicidades: si la norma describe una obligación permanente y no un trámite
  // periódico, el plazo lo declara el establecimiento y se dice así.
  for(const o of OBLIGATION_CATALOG){
   expect(o.source.length,`${o.code} sin fuente`).toBeGreaterThan(20);
   if(o.deadlineAuthority==="ESTABLECIMIENTO")
    expect(o.periodicity,`${o.code}: si el plazo lo declara el establecimiento, no puede traer periodicidad normativa`).toBeNull();
   else expect(o.periodicity,`${o.code}: una periodicidad normativa exige que la fuente la cite`).not.toBeNull();
  }
 });
 it("y cada una dice quién fija su plazo",()=>{
  for(const o of OBLIGATION_CATALOG)expect(["NORMA","ESTABLECIMIENTO"]).toContain(o.deadlineAuthority);
 });
 it("el módulo declara lo que NO verifica",()=>{
  // Sin esto, «seguimiento de cumplimiento regulatorio» se leería como que el sistema comprueba el contenido.
  expect(REGULATORY_OBLIGATIONS_LIMITS).toMatch(/NO se modelan los plazos normativos/);
  expect(REGULATORY_OBLIGATIONS_LIMITS).toMatch(/CONTENIDO del cumplimiento/);
 });
});

describe("el hallazgo no puede volver (R2B-024)",()=>{
 const src=fs.readFileSync("apps/web/lib/regulatory-obligation-lifecycle.ts","utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
 it("la periodicidad ya no es texto libre",()=>{
  expect(src,"`periodicity:z.string()` no permitía calcular nada").not.toMatch(/periodicity:z\.string\(\)/);
  expect(src).toMatch(/periodicity:z\.enum\(PERIODICITIES\)/);
 });
 it("existen cumplir y renovar, y cumplir exige evidencia",()=>{
  expect(src).toMatch(/handleRegulatoryObligationComply/);
  expect(src).toMatch(/handleRegulatoryObligationRenew/);
  expect(src,"«cumplida» sin nada que lo respalde es una opinión").toMatch(/evidenceRef:z\.string\(\)/);
 });
 it("la transición se valida contra el estado REAL del stream",()=>{
  // Es el mismo defecto que R2B-026 documenta en la historia adaptativa, evitado aquí desde el principio.
  expect(src).toMatch(/loadState\(ctx,obligationId\)/);
  expect(src).toMatch(/assertObligationTransition\(from,to\)/);
 });
 it("y las dos rutas nuevas validan el identificador antes de tocar el kernel",()=>{
  for(const r of["compliance","renewal"]){
   const ruta=fs.readFileSync(`apps/web/app/api/v1/regulatory-obligations/[obligationId]/${r}/route.ts`,"utf8");
   expect(ruta,`${r}: el identificador se valida con pathIds (R04-007)`).toMatch(/pathIds\(ctx\.params\)/);
  }
 });
 it("el registro muestra la fecha VIGENTE, no la del alta",()=>{
  // Lo destapó la prueba en vivo: el lector leía solo el evento CREATED, así que una obligación renovada seguía apareciendo
  // con su fecha original y el tablero la habría dejado como «Vencida» para siempre.
  const office=fs.readFileSync("apps/web/lib/runtime/office.ts","utf8");
  expect(office).toMatch(/coalesce\(r\.due_date, a\.payload->>'dueDate'\)/);
  expect(office,"y el estado del ciclo viaja con la fila").toMatch(/lifecycleState/);
 });
});
