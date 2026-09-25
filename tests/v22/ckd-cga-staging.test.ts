import{describe,it,expect}from"vitest";
import{cgaStage,albuminuriaCategory,ckdStage,UACR_CATEGORY_CUTOFFS}from"../../packages/renal-function/src";
import{labReferenceRanges}from"../../packages/lab-reference/src";
// Cotejo de guías, decisión D2 — ESTADIFICACIÓN C-G-A DE LA ENFERMEDAD RENAL CRÓNICA.
//
// EL HALLAZGO DEL COTEJO: la ecuación CKD-EPI 2021 coincide con su fuente, pero la ENFERMEDAD se estadificaba solo por
// filtración. KDIGO la estadifica por causa, filtración Y albuminuria, y la conducta —frecuencia de vigilancia, referencia a
// nefrología— sale de la combinación de las dos últimas.
//
// LA CONSECUENCIA MEDIDA, que es la que justifica el trabajo: un paciente con eGFR 95 y UACR 400 mg/g tiene ERC de riesgo
// MUY ALTO según KDIGO, y el sistema lo presentaba como «G1 — normal o alto». Daño renal establecido leído como función
// renal normal. Este test fija que eso no puede volver.

describe("categoría de albuminuria (A), con los cortes de KDIGO",()=>{
 it("A1 < 30, A2 30–300, A3 > 300 mg/g",()=>{
  expect(albuminuriaCategory(29.9)).toBe("A1");
  expect(albuminuriaCategory(30)).toBe("A2");
  expect(albuminuriaCategory(300)).toBe("A2");   // el límite EXACTO pertenece a A2 según el texto («30–300»)
  expect(albuminuriaCategory(300.1)).toBe("A3");
  expect(albuminuriaCategory(-1),"un valor imposible no se categoriza").toBeUndefined();
 });
 it("los cortes son los mismos que el catálogo de laboratorio: una sola fuente",()=>{
  // Antes la ruta HTTP repetía los cortes por su cuenta y discrepaba en el límite exacto de 300 mg/g.
  const uacr=labReferenceRanges().find(r=>r.analyte==="UACR")!;
  expect(uacr.normalHigh,"A1/A2 del catálogo").toBe(UACR_CATEGORY_CUTOFFS.a1Below-1);
  expect(uacr.criticalHigh,"A2/A3 del catálogo").toBe(UACR_CATEGORY_CUTOFFS.a3Above);
 });
});

describe("riesgo C-G-A (tabla de KDIGO transcrita, no interpolada)",()=>{
 it("EL CASO DEL HALLAZGO: filtración normal con albuminuria grave es riesgo MUY ALTO, no «normal»",()=>{
  const r=cgaStage(95,400)!;
  expect(r.gCategory).toBe("G1");
  expect(r.aCategory).toBe("A3");
  expect(r.risk,"un eGFR 95 con UACR 400 no es función renal normal").not.toBe("LOW");
  expect(r.risk).toBe("HIGH");
  expect(r.label).toContain("G1A3");
  expect(r.action,"y la conducta tiene que decir qué hacer").toMatch(/nefrología|6 meses/i);
 });
 it("la diagonal de la tabla: a igual filtración, más albuminuria es más riesgo",()=>{
  for(const egfr of [95,75,50,35,20,10]){
   const a1=cgaStage(egfr,10)!.risk,a2=cgaStage(egfr,100)!.risk,a3=cgaStage(egfr,500)!.risk;
   const orden=["LOW","MODERATE","HIGH","VERY_HIGH"];
   expect(orden.indexOf(a2),`eGFR ${egfr}: A2 no puede ser menor que A1`).toBeGreaterThanOrEqual(orden.indexOf(a1));
   expect(orden.indexOf(a3),`eGFR ${egfr}: A3 no puede ser menor que A2`).toBeGreaterThanOrEqual(orden.indexOf(a2));
  }
 });
 it("y a igual albuminuria, menos filtración es más riesgo",()=>{
  const orden=["LOW","MODERATE","HIGH","VERY_HIGH"];
  for(const uacr of [10,100,500]){
   const porG=[95,75,50,35,20,10].map(e=>orden.indexOf(cgaStage(e,uacr)!.risk));
   for(let i=1;i<porG.length;i++)expect(porG[i]!,`UACR ${uacr}: el riesgo no puede bajar al caer la filtración`).toBeGreaterThanOrEqual(porG[i-1]!);
  }
 });
 it("las celdas de la guía que más se equivocan, una por una",()=>{
  expect(cgaStage(95,10)!.risk).toBe("LOW");        // G1A1
  expect(cgaStage(75,100)!.risk).toBe("MODERATE");  // G2A2
  expect(cgaStage(50,10)!.risk).toBe("MODERATE");   // G3aA1 — filtración baja con albuminuria normal YA es riesgo
  expect(cgaStage(35,10)!.risk).toBe("HIGH");       // G3bA1
  expect(cgaStage(20,10)!.risk).toBe("VERY_HIGH");  // G4A1 — a esta altura el riesgo es muy alto con cualquier albuminuria
  expect(cgaStage(10,10)!.risk).toBe("VERY_HIGH");  // G5A1
 });
 it("SIN albuminuria no se afirma riesgo: se dice qué falta",()=>{
  // Estadificar por filtración sola y llamarlo riesgo es exactamente el defecto que corrige esta decisión.
  const r=cgaStage(50)!;
  expect(r.complete).toBe(false);
  expect(r.missing.join(" ")).toMatch(/albúmina\/creatinina|UACR/);
  expect(r.action,"y hay que pedir la prueba que falta").toMatch(/[Ss]olicite/);
  expect(r.label).toMatch(/incompleto/);
 });
 it("la categoría G sigue siendo la de siempre: esta decisión añade, no reemplaza",()=>{
  expect(cgaStage(95,10)!.gCategory).toBe(ckdStage(95).stage);
  expect(cgaStage(35,10)!.gCategory).toBe("G3b");
  expect(cgaStage(NaN,10),"sin filtración no hay estadio").toBeUndefined();
 });
});
