import{describe,it,expect}from"vitest";
import{checkDoseCeiling,checkPediatricDose}from"../../packages/medication-validation/src";
import{evaluatePrescriptionSafety,summarizeForEvent,ageInYears,decideOverride,OVERRIDABLE_BARRIERS,HARD_BARRIERS,OVERRIDE_MIN_JUSTIFICATION,type PrescriptionSafetyInput,type BarrierId}from"../../packages/prescription-safety/src";
// Auditoría 2026-09-19 (C-03, C-04, C-05, C-14, C-16): "no pude evaluar" NUNCA se presenta como "seguro".
// Estos casos fijan el comportamiento correcto del evaluador ÚNICO que comparten el dry-run y PRESCRIBE.
const base:PrescriptionSafetyInput={drugCode:"ibuprofeno-400",dose:"400mg",route:"Oral",frequency:"c/8h",
 allergies:[],activeDrugCodes:[],activeConditionCodes:[],egfr:90,weightKg:70,ageYears:40};
const st=(e:ReturnType<typeof evaluatePrescriptionSafety>,id:BarrierId)=>e.barriers.find(b=>b.id===id)?.status;

describe("evaluador único de seguridad de prescripción",()=>{
 it("adulto, fármaco en catálogo, datos completos -> CLEAR sin confirmación",()=>{
  const e=evaluatePrescriptionSafety(base);
  expect(e.verdict).toBe("CLEAR");expect(e.requiresAcknowledgement).toBe(false);
  expect(st(e,"doseCeiling")).toBe("PASSED");expect(st(e,"renal")).toBe("PASSED");expect(st(e,"pediatricDose")).toBe("NOT_APPLICABLE");
 });
 it("fármaco FUERA de catálogo -> nada se da por seguro y exige confirmación expresa",()=>{
  // El caso original era apixabán; entró al catálogo en el lote 11f (R03-23); vancomicina en el lote 2 de 2026. La prueba
  // usa otro fármaco realmente ausente. Lo que se verifica es la REGLA —fuera del catálogo nada se da por verificado—, no el nombre.
  const e=evaluatePrescriptionSafety({...base,drugCode:"cloranfenicol",dose:"500mg",frequency:"c/8h",egfr:15});
  expect(e.catalogResolved).toBe(false);expect(e.verdict).toBe("REVIEW");expect(e.requiresAcknowledgement).toBe(true);
  for(const id of["catalog","interaction","duplicate","contraindication","doseCeiling","renal"] as const)expect(st(e,id)).toBe("NOT_EVALUATED");
  expect(e.barriers.some(b=>b.status==="PASSED"&&b.id!=="order")).toBe(false); // ninguna barrera clínica "pasó"
 });
 it("amoxicilina con TFG 10 -> CAUTION renal (C-15: antes 'sin regla'); no fuerza confirmación pero el veredicto es REVIEW",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"amoxicilina-500",dose:"500mg",frequency:"c/8h",egfr:10});
  expect(st(e,"renal")).toBe("CAUTION");expect(e.verdict).toBe("REVIEW");expect(e.requiresAcknowledgement).toBe(false);
 });
 it("fármaco CON regla renal y paciente SIN eGFR -> NOT_EVALUATED y confirmación",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"metformina-850",dose:"850mg",frequency:"c/12h",egfr:undefined});
  expect(st(e,"renal")).toBe("NOT_EVALUATED");expect(e.requiresAcknowledgement).toBe(true);
 });
 it("metformina con TFG 20 -> BLOCK",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"metformina-850",dose:"850mg",frequency:"c/12h",egfr:20});
  expect(st(e,"renal")).toBe("BLOCKED");expect(e.verdict).toBe("BLOCK");
 });
 it("menor de edad SIN peso -> BLOQUEO (R03-27: antes era un aviso que se confirmaba y se seguía)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"paracetamol",dose:"500mg",frequency:"c/6h",weightKg:undefined,ageYears:2});
  expect(st(e,"pediatricDose")).toBe("BLOCKED");expect(e.verdict).toBe("BLOCK");
  expect(e.barriers.find(b=>b.id==="pediatricDose")?.reason).toBe("WEIGHT_REQUIRED");
 });
 it("niño de 10 kg con paracetamol 500 mg c/6h (200 mg/kg/día) -> BLOCK por dosis pediátrica",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"paracetamol",dose:"500mg",frequency:"c/6h",weightKg:10,ageYears:2});
  expect(st(e,"pediatricDose")).toBe("BLOCKED");expect(e.verdict).toBe("BLOCK");
 });
 it("dosis en tabletas SIN concentración en el código ('2 tab' de 'ibuprofeno') -> NOT_EVALUATED, no 'OK'",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"ibuprofeno",dose:"2 tab"});
  expect(["NOT_EVALUATED","BLOCKED"]).toContain(st(e,"doseCeiling")); // si la orden es inválida, además bloquea por formato
  expect(st(e,"doseCeiling")).not.toBe("PASSED");
 });
 it("fármacos ACTIVOS fuera de catálogo -> interacciones con cobertura parcial declarada",()=>{
  const e=evaluatePrescriptionSafety({...base,activeDrugCodes:["coumadin-generico-raro"]});
  expect(st(e,"interaction")).toBe("NOT_EVALUATED");expect(e.unresolvedActiveDrugs).toEqual(["coumadin-generico-raro"]);
 });
 it("duplicidad terapéutica bloquea igual en el dry-run que en la escritura",()=>{
  const e=evaluatePrescriptionSafety({...base,activeDrugCodes:["naproxeno-250"]});
  expect(st(e,"duplicate")).toBe("BLOCKED");
 });
 it("el resumen persistible no contiene PHI ni valores clínicos: solo id/estado/razón y la confirmación",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"cloranfenicol"});
  const s=summarizeForEvent(e,{acknowledged:true,justification:"Indicación de cardiología, sin alternativa en catálogo"});
  expect(s.acknowledgedUnverified).toBe(true);expect(s.catalogResolved).toBe(false);
  expect(Object.keys(s.barriers[0]!).sort()).toEqual(expect.arrayContaining(["id","status"]));
  expect(JSON.stringify(s)).not.toMatch(/eGFR|mg\/día|kg/);
 });
});
// Auditoría 2026-09-19 (U-19): anulación justificada de un bloqueo. Nombrada barrera por barrera, con justificación, y
// NUNCA sobre techo de dosis / dosis pediátrica / orden mal formada.
describe("anulación justificada de un bloqueo (U-19)",()=>{
 const J="Paciente en diálisis trisemanal; dosis acordada con nefrología";
 it("las listas de barreras anulables y duras son complementarias y cubren todas las barreras",()=>{
  const all:BarrierId[]=["order","catalog","allergy","interaction","duplicate","contraindication","doseCeiling","duration","pediatricDose","renal"];
  expect([...OVERRIDABLE_BARRIERS,...HARD_BARRIERS].sort()).toEqual([...all].sort());
  for(const dura of["doseCeiling","duration","pediatricDose"])expect(OVERRIDABLE_BARRIERS,dura).not.toContain(dura);
 });
 it("sin bloqueo: ok y sin anulación que registrar; nombrar una barrera que no bloquea se rechaza",()=>{
  const e=evaluatePrescriptionSafety(base);
  expect(e.blockedOverridable).toEqual([]);expect(e.blockedHard).toEqual([]);
  expect(decideOverride(e,undefined)).toEqual({ok:true,override:null});
  const d=decideOverride(e,{barriers:["renal"],justification:J});
  expect(d.ok).toBe(false);if(!d.ok){expect(d.code).toBe("OVERRIDE_NOT_BLOCKED");expect(d.unmatched).toEqual(["renal"]);}
 });
 it("bloqueo renal (metformina, TFG 20): sin anulación -> OVERRIDE_REQUIRED nombrando lo que falta; con anulación completa -> ok y queda registrada",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"metformina-850",dose:"850mg",frequency:"c/12h",egfr:20});
  expect(e.blockedOverridable).toEqual(["renal"]);expect(e.blockedHard).toEqual([]);
  const d0=decideOverride(e,undefined);expect(d0.ok).toBe(false);if(!d0.ok){expect(d0.code).toBe("OVERRIDE_REQUIRED");expect(d0.unmatched).toEqual(["renal"]);}
  const d1=decideOverride(e,{barriers:["renal"],justification:"corto"});expect(d1.ok).toBe(false);if(!d1.ok)expect(d1.code).toBe("JUSTIFICATION_TOO_SHORT");
  expect(J.length).toBeGreaterThanOrEqual(OVERRIDE_MIN_JUSTIFICATION);
  const d2=decideOverride(e,{barriers:["renal"],justification:`  ${J}  `});
  expect(d2).toEqual({ok:true,override:{barriers:["renal"],justification:J}});
  const s=summarizeForEvent(e,{acknowledged:false},d2.ok?{override:d2.override,by:"user-1"}:undefined);
  expect(s.override).toEqual({barriers:["renal"],justification:J,by:"user-1"});
  expect(summarizeForEvent(e,{acknowledged:false}).override).toBeUndefined();
 });
 it("dos bloqueos anulables: hay que nombrar los dos (uno solo no basta)",()=>{
  // duplicidad (naproxeno activo) + renal (ibuprofeno con TFG 25 exige precaución/bloqueo según regla) -> se usa contraindicación por dx
  const e=evaluatePrescriptionSafety({...base,activeDrugCodes:["naproxeno-250"],egfr:20});
  expect(e.blockedOverridable.length).toBeGreaterThanOrEqual(2);
  const d=decideOverride(e,{barriers:["duplicate"],justification:J});
  expect(d.ok).toBe(false);if(!d.ok){expect(d.code).toBe("OVERRIDE_REQUIRED");expect(d.unmatched).toEqual(e.blockedOverridable.filter(x=>x!=="duplicate"));}
  const all=decideOverride(e,{barriers:e.blockedOverridable,justification:J});expect(all.ok).toBe(true);
 });
 it("techo de dosis y dosis pediátrica NO se anulan con ninguna justificación (HARD_BLOCK)",()=>{
  const adult=evaluatePrescriptionSafety({...base,drugCode:"paracetamol-500",dose:"2000mg",frequency:"c/4h"});
  expect(adult.blockedHard).toEqual(["doseCeiling"]);
  const d=decideOverride(adult,{barriers:["renal","allergy"],justification:J});
  expect(d.ok).toBe(false);if(!d.ok){expect(d.code).toBe("HARD_BLOCK");expect(d.hard).toEqual(["doseCeiling"]);}
  const child=evaluatePrescriptionSafety({...base,drugCode:"paracetamol-500",dose:"500mg",frequency:"c/6h",weightKg:10,ageYears:2});
  expect(child.blockedHard).toContain("pediatricDose");
  expect(decideOverride(child,{barriers:[],justification:J}).ok).toBe(false);
 });
});
describe("ageInYears",()=>{
 it("edad cumplida en UTC y fechas inválidas",()=>{
  expect(ageInYears("2000-09-20","2026-09-19T12:00:00Z")).toBe(25);
  expect(ageInYears("2000-09-19","2026-09-19T12:00:00Z")).toBe(26);
  expect(ageInYears("no-fecha","2026-09-19T12:00:00Z")).toBeUndefined();
  expect(ageInYears("2030-01-01","2026-09-19T12:00:00Z")).toBeUndefined();
 });
});
describe("alergias con gravedad en el evaluador (auditoría C-06)",()=>{
 it("intolerancia leve a penicilina + ceftriaxona -> CAUTION que EXIGE confirmación (no bloquea, no se ignora)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"ceftriaxona-1g",dose:"1g",route:"IV",frequency:"c/24h",allergies:[{substance:"penicilina",severity:"MILD",reaction:"náusea"}]});
  expect(st(e,"allergy")).toBe("CAUTION");expect(e.verdict).toBe("REVIEW");expect(e.requiresAcknowledgement).toBe(true);
 });
 it("R03-24: anafilaxia a penicilina + ceftriaxona -> PRECAUCIÓN, no bloqueo (cadena lateral R1 distinta)",()=>{
  // Antes bloqueaba en bloque por el anillo betalactámico. La evidencia (Shenoy, JAMA 2019) sitúa la reactividad con
  // ceftriaxona en ~1 %, y el bloqueo empujaba a vancomicina/quinolonas: más C. difficile y peores desenlaces. El dato
  // se le muestra al médico (precaución con la explicación) en vez de decidir por él.
  const cef=evaluatePrescriptionSafety({...base,drugCode:"ceftriaxona-1g",dose:"1g",route:"IV",frequency:"c/24h",allergies:[{substance:"penicilina",severity:"SEVERE",reaction:"anafilaxia"}]});
  expect(st(cef,"allergy")).toBe("CAUTION");expect(cef.verdict).not.toBe("BLOCK");
  expect(JSON.stringify(cef)).toMatch(/R1 DISTINTA/);
 });
 it("anafilaxia a penicilina + cefalexina (MISMA cadena lateral R1) -> BLOCK sin posibilidad de confirmación",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"cefalexina-500",dose:"500mg",route:"oral",frequency:"c/8h",allergies:[{substance:"penicilina",severity:"SEVERE",reaction:"anafilaxia"}]});
  expect(st(e,"allergy")).toBe("BLOCKED");expect(e.verdict).toBe("BLOCK");
 });
 it("alergia a AINE + diclofenaco -> BLOCK (antes: 'sin conflicto' porque diclofenaco no estaba en el catálogo)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"diclofenaco-50",dose:"50mg",frequency:"c/8h",allergies:[{substance:"AINE",severity:"SEVERE",reaction:"broncoespasmo"}]});
  expect(st(e,"allergy")).toBe("BLOCKED");
 });
});
describe("interacciones y factores del paciente en el evaluador (auditoría C-17)",()=>{
 it("sertralina activa + tramadol -> BLOCK en la barrera (la misma tabla que la pestaña informativa)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"tramadol-50",dose:"50mg",frequency:"c/8h",activeDrugCodes:["sertralina-50"]});
  expect(st(e,"interaction")).toBe("BLOCKED");
 });
 it("paciente de 78 años + AINE -> CAUTION por adulto mayor (Beers), no 'sin interacciones'",()=>{
  const e=evaluatePrescriptionSafety({...base,ageYears:78});
  expect(st(e,"interaction")).toBe("CAUTION");expect(e.barriers.find(b=>b.id==="interaction")?.detail).toMatch(/Adulto mayor/);
 });
});
describe("techos de dosis (auditoría C-15)",()=>{
 it("'2 tab' de ibuprofeno-400 c/6h = 3200 mg/día: se acota con la concentración del código (antes: NO evaluado)",()=>{
  const e=evaluatePrescriptionSafety({...base,dose:"2 tab",frequency:"c/6h"});
  expect(st(e,"doseCeiling")).toBe("PASSED");expect(e.barriers.find(b=>b.id==="doseCeiling")?.detail).toMatch(/3200 mg\/día.*concentración/);
  expect(st(evaluatePrescriptionSafety({...base,dose:"3 tab",frequency:"c/6h"}),"doseCeiling")).toBe("BLOCKED"); // 4800 > 3200
 });
 it("warfarina: sin tope fijo (por INR) -> NOT_APPLICABLE revisado, no 'sin regla'",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"warfarina-5",dose:"5mg",frequency:"c/24h"});
  expect(st(e,"doseCeiling")).toBe("NOT_APPLICABLE");
 });
 it("'PRN' sigue sin poder acotarse: NOT_EVALUATED (exige confirmación), nunca OK",()=>{
  const e=evaluatePrescriptionSafety({...base,frequency:"PRN"});
  expect(["NOT_EVALUATED","BLOCKED"]).toContain(st(e,"doseCeiling"));expect(st(e,"doseCeiling")).not.toBe("PASSED");
 });
});

// Auditoría 2026-09-19, anexo R03 — R03-26 (techo por vía, duración y edad) y R03-27 (pediatría por edad, peso obligatorio).
describe("techo de dosis por vía, duración y edad (R03-26)",()=>{
 const st2=(e:ReturnType<typeof evaluatePrescriptionSafety>,id:string)=>e.barriers.find(b=>b.id===id)!;
 it("ketorolaco 30 mg c/6h: correcto por vía IV, TRIPLE del máximo por vía ORAL",()=>{
  // El caso exacto del anexo: 120 mg/día pasaba como correcto sin mirar la vía (máximo oral 40 mg/día).
  const iv=evaluatePrescriptionSafety({...base,drugCode:"ketorolaco-30",dose:"30mg",route:"IV",frequency:"c/6h",ageYears:40,durationDays:3});
  expect(st2(iv,"doseCeiling").status).toBe("PASSED");
  const oral=evaluatePrescriptionSafety({...base,drugCode:"ketorolaco-30",dose:"30mg",route:"ORAL",frequency:"c/6h",ageYears:40,durationDays:3});
  expect(st2(oral,"doseCeiling").status).toBe("BLOCKED");
  expect(st2(oral,"doseCeiling").detail).toMatch(/40 mg\/día/);
 });
 it("citalopram 60 mg/día: excede siempre, y a partir de los 60 años el techo baja a 20 (FDA)",()=>{
  const joven=evaluatePrescriptionSafety({...base,drugCode:"citalopram-20",dose:"60mg",route:"ORAL",frequency:"QD",ageYears:40});
  expect(st2(joven,"doseCeiling").status).toBe("BLOCKED"); // 60 > 40
  const mayor=evaluatePrescriptionSafety({...base,drugCode:"citalopram-20",dose:"30mg",route:"ORAL",frequency:"QD",ageYears:70});
  expect(st2(mayor,"doseCeiling").status).toBe("BLOCKED"); // 30 > 20 por edad
  expect(st2(mayor,"doseCeiling").detail).toMatch(/QT/);
  const mayorOk=evaluatePrescriptionSafety({...base,drugCode:"citalopram-20",dose:"20mg",route:"ORAL",frequency:"QD",ageYears:70});
  expect(st2(mayorOk,"doseCeiling").status).toBe("PASSED");
 });
 it("la duración es una barrera propia: ketorolaco 7 días se bloquea; sin duración declarada, NO se da por buena",()=>{
  const largo=evaluatePrescriptionSafety({...base,drugCode:"ketorolaco-10",dose:"10mg",route:"ORAL",frequency:"c/8h",ageYears:40,durationDays:7});
  expect(st2(largo,"duration").status).toBe("BLOCKED");
  expect(st2(largo,"duration").detail).toMatch(/5/);
  const sinDuracion=evaluatePrescriptionSafety({...base,drugCode:"ketorolaco-10",dose:"10mg",route:"ORAL",frequency:"c/8h",ageYears:40});
  expect(st2(sinDuracion,"duration").status).toBe("NOT_EVALUATED");
  expect(sinDuracion.verdict).not.toBe("CLEAR");
  const corto=evaluatePrescriptionSafety({...base,drugCode:"ketorolaco-10",dose:"10mg",route:"ORAL",frequency:"c/8h",ageYears:40,durationDays:3});
  expect(st2(corto,"duration").status).toBe("PASSED");
 });
 it("un fármaco sin límite de duración no arrastra una advertencia inútil",()=>{
  const e=evaluatePrescriptionSafety({...base,ageYears:40});
  expect(st2(e,"duration").status).toBe("NOT_APPLICABLE");
 });
 it("`evaluable` y `exceeded` son campos distintos: no verificado ≠ correcto",()=>{
  const prn=checkDoseCeiling("paracetamol","1g","PRN");
  expect(prn.evaluable).toBe(false);expect(prn.exceeded).toBe(false);expect(prn.checked).toBe(prn.evaluable);
  const ok=checkDoseCeiling("paracetamol","500mg","c/8h");
  expect(ok.evaluable).toBe(true);expect(ok.exceeded).toBe(false);
 });
});

describe("dosis pediátrica: criterio por EDAD y peso obligatorio (R03-27)",()=>{
 const st2=(e:ReturnType<typeof evaluatePrescriptionSafety>,id:string)=>e.barriers.find(b=>b.id===id)!;
 it("un menor SIN peso registrado BLOQUEA la prescripción (antes: aviso que se confirmaba)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"paracetamol-500",dose:"500mg",route:"ORAL",frequency:"c/6h",ageYears:4,weightKg:undefined});
  const b=st2(e,"pediatricDose");
  expect(b.status).toBe("BLOCKED");
  expect(b.reason).toBe("WEIGHT_REQUIRED");
  expect(b.overridable).toBe(false);          // no se anula con una justificación: se registra el peso
  expect(e.verdict).toBe("BLOCK");
 });
 it("un ADOLESCENTE de 45 kg sigue verificándose por peso (antes quedaba fuera por pesar >40 kg)",()=>{
  const e=evaluatePrescriptionSafety({...base,drugCode:"ibuprofeno-400",dose:"800mg",route:"ORAL",frequency:"c/6h",ageYears:15,weightKg:45});
  // 3 200 mg/día / 45 kg = 71 mg/kg/día, muy por encima de 40.
  expect(st2(e,"pediatricDose").status).toBe("BLOCKED");
 });
 it("el límite es el MÍNIMO entre el ponderal y el techo absoluto",()=>{
  // 60 kg, paracetamol 1.5 g c/6h = 6 000 mg/día = 100 mg/kg/día: excede ambos.
  const ambos=evaluatePrescriptionSafety({...base,drugCode:"paracetamol-500",dose:"1500mg",route:"ORAL",frequency:"c/6h",ageYears:16,weightKg:60});
  expect(st2(ambos,"pediatricDose").status).toBe("BLOCKED");
  // 70 kg, 1 g c/6h = 4 000 mg/día = 57 mg/kg/día: el ponderal pasa (<75) y el absoluto justo también (=4 000).
  const limite=evaluatePrescriptionSafety({...base,drugCode:"paracetamol-500",dose:"1000mg",route:"ORAL",frequency:"c/6h",ageYears:17,weightKg:70});
  expect(st2(limite,"pediatricDose").status).toBe("PASSED");
  // 70 kg, 1.25 g c/6h = 5 000 mg/día = 71 mg/kg/día: el PONDERAL pasa y el ABSOLUTO no. Antes, cada límite vivía en
  // una función distinta y esta orden no la detenía ninguna de las dos.
  const soloAbsoluto=checkPediatricDose("paracetamol","1250mg","c/6h",70,17);
  expect(soloAbsoluto.exceeded).toBe(true);
  expect(soloAbsoluto.boundedBy).toBe("absolute");
  expect(soloAbsoluto.computedMgPerKgPerDay).toBeLessThan(soloAbsoluto.maxMgPerKgPerDay!);
 });
 it("un adulto no pasa por la barrera pediátrica",()=>{
  const e=evaluatePrescriptionSafety({...base,ageYears:40,weightKg:70});
  expect(st2(e,"pediatricDose").status).toBe("NOT_APPLICABLE");
 });
 it("la tabla mg/kg cubre ya los fármacos pediátricos de uso corriente",()=>{
  for(const d of["paracetamol","ibuprofeno","amoxicilina","azitromicina","cefalexina","clindamicina","prednisona","ondansetron"])
   expect(checkPediatricDose(d,"100mg","c/8h",15,5).evaluable,d).toBe(true);
 });
});

// Auditoría 2026-09-19, anexo R03 (vector F11): «2 tab» se acotaba con el SUFIJO DEL CÓDIGO, que es texto que teclea
// alguien: `ibuprofeno-4000` (un cero de más) valía como presentación de 4 g.
describe("la concentración de «1 tab» sale del CATÁLOGO, no del código (R03-F11)",()=>{
 const st=(e:ReturnType<typeof evaluatePrescriptionSafety>,id:string)=>e.barriers.find(b=>b.id===id)!;
 const base2={dose:"2 tab",route:"ORAL",frequency:"c/6h",allergies:[],activeDrugCodes:[],activeConditionCodes:[],ageYears:40,weightKg:70};
 it("una concentración que el catálogo confirma se usa",()=>{
  const e=evaluatePrescriptionSafety({...base2,drugCode:"ibuprofeno-400"});
  expect(st(e,"doseCeiling").status).toBe("PASSED");   // 2×400×4 = 3 200 mg/día, justo el máximo
  expect(st(e,"doseCeiling").detail).toMatch(/3200 mg\/día/);
 });
 it("una concentración que NO existe se rechaza: no se acota con un dato inventado",()=>{
  const e=evaluatePrescriptionSafety({...base2,drugCode:"ibuprofeno-4000"});
  expect(st(e,"doseCeiling").status).toBe("NOT_EVALUATED");
  expect(e.verdict).not.toBe("CLEAR");
 });
 it("sin sufijo, un fármaco de presentación ÚNICA se resuelve con la del catálogo",()=>{
  // citalopram existe solo en 20 mg: «2 tab c/6h» son 160 mg/día, cuatro veces el máximo.
  const e=evaluatePrescriptionSafety({...base2,drugCode:"citalopram"});
  expect(st(e,"doseCeiling").status).toBe("BLOCKED");
  expect(st(e,"doseCeiling").detail).toMatch(/160 mg\/día/);
 });
 it("con varias presentaciones y ninguna declarada NO se adivina",()=>{
  const e=evaluatePrescriptionSafety({...base2,drugCode:"sertralina"});
  expect(st(e,"doseCeiling").status).toBe("NOT_EVALUATED");
 });
 it("el catálogo declara las presentaciones y distingue la forma farmacéutica",async()=>{
  const{presentationsFor,unitStrengthFromCatalog}=await import("../../packages/drug-catalog/src");
  const ibu=presentationsFor("ibuprofeno-400");
  expect(ibu.map(p=>p.strengthMg)).toContain(400);
  expect(ibu.some(p=>p.form==="SUSPENSION"&&p.perMl===5)).toBe(true); // la suspensión no es «una tableta»
  const r=unitStrengthFromCatalog("ibuprofeno-400",400);
  expect(r.strengthMg).toBe(400);
  const malo=unitStrengthFromCatalog("ibuprofeno-4000",4000);
  expect(malo.strengthMg).toBeNull();
  if(malo.strengthMg===null)expect(malo.reason).toBe("NOT_IN_CATALOG_PRESENTATIONS");
 });
});
