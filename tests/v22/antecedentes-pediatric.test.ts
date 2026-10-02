import{describe,it,expect}from"vitest";
import{AntecedentesContentSchema}from"../../apps/web/lib/antecedentes-lifecycle";
import{isPediatricAge,antFreshness,ANT_PRENATAL,ANT_PERINATAL,ANT_ALIMENTACION,ANT_DESARROLLO,ANT_INMUNIZA,ANT_REVERIFY_DAYS}from"../../apps/web/app/workspace/shared";
// Historia clínica (formato del PDF Medicina General): el cuestionario basal se captura una vez, se AUTO-SELECCIONA
// adulto/pediátrico por la edad, y se RE-VERIFICA cada 6 meses. Aquí se prueban las tres reglas, sin fabricar datos:
// los campos son los del formato y la selección/cadencia se derivan del expediente.

describe("historia clínica: formato pediátrico/adulto + re-verificación a 6 meses",()=>{
 it("el esquema acepta el formato PEDIÁTRICO (prenatales/perinatales/alimentación/desarrollo/inmunizaciones + kind)",()=>{
  const r=AntecedentesContentSchema.safeParse({
   heredofamiliares:{flags:["Diabetes"]},
   prenatales:{flags:["Control prenatal"],notas:"sin complicaciones"},
   perinatales:{flags:["A término","Cesárea","Tamiz metabólico"]},
   alimentacion:{flags:["Lactancia exclusiva"]},
   desarrollo:{flags:["Desarrollo acorde a la edad"]},
   inmunizaciones:{flags:["Esquema completo para la edad"]},
   kind:"PEDIATRIC",
  });
  expect(r.success,r.success?"":JSON.stringify(r.error.issues)).toBe(true);
 });
 it("sigue aceptando el formato ADULTO y RECHAZA claves desconocidas (.strict)",()=>{
  expect(AntecedentesContentSchema.safeParse({ginecoObstetricos:{aplica:true,notas:"G2P1C1"},kind:"ADULT"}).success).toBe(true);
  expect(AntecedentesContentSchema.safeParse({seccionInventada:{x:1}}).success).toBe(false);
  expect(AntecedentesContentSchema.safeParse({kind:"OTRO"}).success).toBe(false); // kind solo ADULT|PEDIATRIC
 });
 it("auto-selección por edad: <18 → pediátrico; ≥18 → adulto; sin edad → adulto (no asume niño)",()=>{
  for(const a of [0,2,10,17])expect(isPediatricAge(a),`edad ${a}`).toBe(true);
  for(const a of [18,40,90])expect(isPediatricAge(a),`edad ${a}`).toBe(false);
  expect(isPediatricAge(undefined)).toBe(false);expect(isPediatricAge(null)).toBe(false);
 });
 it("re-verificación a 6 meses: NEVER sin captura; CURRENT reciente; DUE pasados 180 días de la última actualización",()=>{
  expect(antFreshness(false,undefined).status).toBe("NEVER");
  expect(antFreshness(true,new Date(Date.now()-10*86_400_000).toISOString()).status).toBe("CURRENT");
  const vencido=antFreshness(true,new Date(Date.now()-(ANT_REVERIFY_DAYS+5)*86_400_000).toISOString());
  expect(vencido.status).toBe("DUE");
  expect(vencido.days!).toBeGreaterThan(ANT_REVERIFY_DAYS);
 });
 it("los catálogos pediátricos existen y provienen del formato (no inventados)",()=>{
  for(const cat of [ANT_PRENATAL,ANT_PERINATAL,ANT_ALIMENTACION,ANT_DESARROLLO,ANT_INMUNIZA])expect(cat.length).toBeGreaterThan(2);
  expect(ANT_ALIMENTACION).toContain("Lactancia exclusiva");
  expect(ANT_PERINATAL).toContain("Tamiz metabólico");
  expect(ANT_DESARROLLO).toContain("Control de esfínteres");
 });
});
