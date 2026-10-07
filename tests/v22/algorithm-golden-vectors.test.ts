import{describe,it,expect}from"vitest";
import{computeNEWS2,deltaCheck,classifyLab,classifyVital,labReferenceRanges}from"../../packages/lab-reference/src";
import{ALGORITHM_SPECS,SPEC_BY_ID}from"../../packages/clinical-algorithm-specs/src";
// Auditoría 2026-09-19, anexo R02a (ALG-01, ALG-02, ALG-03, ALG-04) — VECTORES GOLDEN DE LA TABLA OFICIAL.
//
// EL HALLAZGO, repetido en cuatro filas del inventario: los algoritmos estaban en «nivel 3» porque sus pruebas eran
// PROPIAS —escritas a partir del mismo código que verifican— y no vectores tomados de la tabla publicada. Es una
// distinción que importa: una prueba derivada del código confirma que el código hace lo que hace; un vector de la tabla
// oficial confirma que hace lo que la GUÍA dice. Si alguien transcribió mal un umbral, la primera pasa y la segunda falla.
//
// LO QUE ESTE FICHERO ES Y NO ES. Cada vector lleva **de dónde sale**, y se eligen los BORDES, que es donde una
// transcripción se rompe: el valor que puntúa 2 y el inmediatamente anterior que puntúa 1. No se inventa ninguna cifra:
// donde el umbral de este sistema es un criterio operativo propio y no un corte publicado, se dice y **no se finge un
// vector golden** — se comprueba la coherencia interna y se deja declarado, porque un vector «oficial» inventado sería
// peor que no tener vectores.
//
// Lo que sigue PENDIENTE y es del dueño: la validación clínica de los umbrales por un médico responsable (R09-020,
// R09-025). Estos vectores prueban FIDELIDAD a la fuente citada, no que la fuente sea la correcta para este consultorio.

describe("NEWS2: vectores de la tabla del Royal College of Physicians (2017) — R02a-ALG-03",()=>{
 // La tabla NEWS2 asigna 0–3 puntos por parámetro. Se prueban los BORDES de cada franja, que es donde se rompe una
 // transcripción, y el total resultante. Parámetros no dados = no puntúan (el sistema no los asume normales).
 const base={resp:16,spo2:97,supplementalO2:false,sbp:120,hr:70,consciousness:"A",temp:36.8};

 it("un paciente en todos los rangos normales de la tabla puntúa 0",()=>{
  const r=computeNEWS2(base);
  expect(r.score,"la fila 'normal' de las siete columnas suma 0").toBe(0);
 });

 it("frecuencia respiratoria: los bordes de la tabla (≤8=3, 9–11=1, 12–20=0, 21–24=2, ≥25=3)",()=>{
  const fr=(v:number)=>computeNEWS2({...base,resp:v}).score;
  expect(fr(8),"≤8 respiraciones/min puntúa 3").toBe(3);
  expect(fr(9),"9 es el primer valor de la franja 9–11, que puntúa 1").toBe(1);
  expect(fr(11),"11 cierra la franja de 1").toBe(1);
  expect(fr(12),"12 entra en la franja normal").toBe(0);
  expect(fr(20),"20 cierra la franja normal").toBe(0);
  expect(fr(21),"21 abre la franja 21–24, que puntúa 2").toBe(2);
  expect(fr(24),"24 cierra la franja de 2").toBe(2);
  expect(fr(25),"≥25 puntúa 3").toBe(3);
 });

 it("saturación, escala 1: los bordes (≤91=3, 92–93=2, 94–95=1, ≥96=0)",()=>{
  const sp=(v:number)=>computeNEWS2({...base,spo2:v}).score;
  expect(sp(91)).toBe(3);expect(sp(92)).toBe(2);expect(sp(93)).toBe(2);
  expect(sp(94)).toBe(1);expect(sp(95)).toBe(1);expect(sp(96)).toBe(0);
 });

 it("oxígeno suplementario puntúa 2 por sí solo, como columna propia de la tabla",()=>{
  expect(computeNEWS2({...base,supplementalO2:true}).score).toBe(2);
 });

 it("presión sistólica: los bordes (≤90=3, 91–100=2, 101–110=1, 111–219=0, ≥220=3)",()=>{
  const bp=(v:number)=>computeNEWS2({...base,sbp:v}).score;
  expect(bp(90)).toBe(3);expect(bp(91)).toBe(2);expect(bp(100)).toBe(2);
  expect(bp(101)).toBe(1);expect(bp(110)).toBe(1);expect(bp(111)).toBe(0);
  expect(bp(219)).toBe(0);expect(bp(220),"la hipertensión extrema también puntúa 3").toBe(3);
 });

 it("frecuencia cardiaca: los bordes (≤40=3, 41–50=1, 51–90=0, 91–110=1, 111–130=2, ≥131=3)",()=>{
  const fc=(v:number)=>computeNEWS2({...base,hr:v}).score;
  expect(fc(40)).toBe(3);expect(fc(41)).toBe(1);expect(fc(50)).toBe(1);
  expect(fc(51)).toBe(0);expect(fc(90)).toBe(0);
  expect(fc(91)).toBe(1);expect(fc(110)).toBe(1);
  expect(fc(111)).toBe(2);expect(fc(130)).toBe(2);expect(fc(131)).toBe(3);
 });

 it("temperatura: los bordes (≤35=3, 35.1–36=1, 36.1–38=0, 38.1–39=1, ≥39.1=2)",()=>{
  const t=(v:number)=>computeNEWS2({...base,temp:v}).score;
  expect(t(35)).toBe(3);expect(t(35.1)).toBe(1);expect(t(36)).toBe(1);
  expect(t(36.1)).toBe(0);expect(t(38)).toBe(0);
  expect(t(38.1)).toBe(1);expect(t(39)).toBe(1);expect(t(39.1)).toBe(2);
 });

 it("nivel de conciencia: alerta=0, cualquier alteración=3 (la columna CVPU de la tabla)",()=>{
  expect(computeNEWS2({...base,consciousness:"A"}).score).toBe(0);
  for(const c of ["C","V","P","U"] as const)
   expect(computeNEWS2({...base,consciousness:c}).score,`${c} puntúa 3`).toBe(3);
 });

 it("el umbral de respuesta urgente de la guía (≥7) coincide con el que declara la ficha del algoritmo",()=>{
  // El número vive en un solo sitio: la ficha. Si alguien lo cambia en el código y no en la ficha, esto falla.
  const spec=SPEC_BY_ID["NEWS2-RCP-2017"];
  expect(spec,"la ficha de NEWS2 debe existir").toBeDefined();
  expect((spec!.bounds as Record<string,unknown>)["umbralRespuestaUrgente"]).toBe(7);
  // Un caso compuesto de la guía: FR 25 (3) + SpO₂ 91 (3) + O₂ suplementario (2) = 8, por encima del umbral.
  const grave=computeNEWS2({...base,resp:25,spo2:91,supplementalO2:true});
  expect(grave.score).toBe(8);
  expect(grave.score>=7,"con 8 puntos la guía pide respuesta urgente").toBe(true);
 });

 it("la ficha cita la versión y el año exactos de la fuente (lo que pedía ALG-03)",()=>{
  const spec=SPEC_BY_ID["NEWS2-RCP-2017"]!;
  expect(spec.source,"sin versión ni año, «NEWS2» no identifica una tabla concreta").toMatch(/Royal College of Physicians/);
  expect(spec.source).toMatch(/2017/);
  expect(spec.validatedIn,"la guía NO está validada en pediatría ni embarazo y la ficha debe decirlo").toMatch(/NO validado en pediatría/);
 });
});

describe("Delta de creatinina: vectores de la definición KDIGO 2012 — R02a-ALG-02",()=>{
 // KDIGO 2012 §2.1: AKI = aumento de creatinina ≥0,3 mg/dL en 48 h, O ≥1,5× el basal en 7 días.
 // Hasta el 07-oct-2026 este sistema usaba 0,5 mg/dL y ×2 sin fuente: aproximadamente el estadio 2, así que NO
 // detectaba el estadio 1. Estos vectores son la definición, no el código anterior.
 const h=(horas:number)=>({priorAt:"2026-10-01T08:00:00.000Z",newAt:new Date(Date.parse("2026-10-01T08:00:00.000Z")+horas*3600_000).toISOString()});

 it("estadio 1 por criterio ABSOLUTO: +0,3 mg/dL en 48 h se marca (antes NO se marcaba)",()=>{
  const r=deltaCheck("CREATININE","0.9","1.2",h(47));
  expect(r.flagged,"0,3 mg/dL en 48 h ES lesión renal aguda según KDIGO").toBe(true);
  expect(r.source,"el aviso debe decir de dónde sale el umbral").toMatch(/KDIGO 2012/);
 });

 it("el borde inferior: +0,29 mg/dL no alcanza el criterio",()=>{
  expect(deltaCheck("CREATININE","0.9","1.19",h(47)).flagged).toBe(false);
 });

 it("la VENTANA del criterio absoluto es de 48 h, no la del analito: a las 72 h ya no es ese criterio",()=>{
  // Es el punto de tener ventanas por criterio. Con una sola ventana de 7 días, el sistema diría «KDIGO» midiendo algo
  // más laxo que KDIGO.
  expect(deltaCheck("CREATININE","0.9","1.2",h(72)).flagged,"+0,3 a las 72 h no cumple el criterio de 48 h").toBe(false);
 });

 it("estadio 1 por criterio RELATIVO: ×1,5 en 7 días se marca (antes exigía ×2)",()=>{
  const r=deltaCheck("CREATININE","1.0","1.5",{priorAt:"2026-10-01T08:00:00.000Z",newAt:"2026-10-06T08:00:00.000Z"});
  expect(r.flagged,"1,5× el basal en 7 días ES lesión renal aguda según KDIGO").toBe(true);
 });

 it("×1,49 no alcanza el criterio relativo, y fuera de los 7 días no se evalúa como agudo",()=>{
  expect(deltaCheck("CREATININE","1.0","1.49",{priorAt:"2026-10-01T08:00:00.000Z",newAt:"2026-10-06T08:00:00.000Z"}).flagged).toBe(false);
  const viejo=deltaCheck("CREATININE","1.0","2.0",{priorAt:"2026-01-01T08:00:00.000Z",newAt:"2026-10-06T08:00:00.000Z"});
  expect(viejo.outOfWindow,"duplicarse en nueve meses es progresión crónica, no lesión aguda").toBe(true);
 });

 it("sin fechas se evalúa igual: no tener la fecha del previo no puede volver el aviso silencioso",()=>{
  expect(deltaCheck("CREATININE","0.9","1.2").flagged,"sin fechas, el criterio absoluto se aplica").toBe(true);
 });
});

describe("Toda regla delta declara su fuente, y las que no son de guía lo DICEN — R02a-ALG-02",()=>{
 const ANALITOS=["CREATININE","HEMOGLOBIN","SODIUM","POTASSIUM","PLATELETS","CALCIUM","GLUCOSE"] as const;

 it("las siete reglas llevan fuente en el veredicto que emiten",()=>{
  // Se dispara cada regla con un cambio claramente suficiente y se comprueba que el aviso traiga su procedencia.
  const casos:Record<string,[string,string]>={
   CREATININE:["0.9","2.0"],HEMOGLOBIN:["12","9"],SODIUM:["140","125"],
   POTASSIUM:["4.0","5.5"],PLATELETS:["200","80"],CALCIUM:["9","6"],GLUCOSE:["100","350"],
  };
  for(const a of ANALITOS){
   const[prev,nuevo]=casos[a]!;
   const r=deltaCheck(a,prev,nuevo);
   expect(r.flagged,`${a}: el caso de prueba debería dispararse`).toBe(true);
   expect(r.source,`${a}: aviso sin fuente del umbral`).toBeTruthy();
   expect(r.source!.length,`${a}: la fuente debe ser sustantiva, no una etiqueta`).toBeGreaterThan(40);
  }
 });

 it("la fuente distingue una GUÍA de un criterio operativo de este sistema",()=>{
  // Es la honestidad que separa esta implementación de inventar citas: donde no hay corte publicado, se dice.
  const deGuia=deltaCheck("CREATININE","0.9","2.0").source!;
  expect(deGuia,"KDIGO es una guía: se cita con su año y su sección").toMatch(/KDIGO 2012.*2\.1/s);
  const operativo=deltaCheck("GLUCOSE","100","350").source!;
  expect(operativo,"sin corte publicado, la fuente tiene que declararlo con esas palabras").toMatch(/Criterio OPERATIVO de este sistema/);
  const plaquetas=deltaCheck("PLATELETS","200","80").source!;
  expect(plaquetas,"el 50 % de caída SÍ tiene origen publicado: el score 4T").toMatch(/4T/);
 });
});

describe("Rangos de laboratorio: cada analito cita su fuente y los bordes son inclusivos — R02a-ALG-01",()=>{
 it("los 30 analitos del catálogo tienen fuente, y ninguna es un marcador de relleno",()=>{
  const filas=labReferenceRanges();
  expect(filas.length,"el catálogo no debería encogerse").toBeGreaterThanOrEqual(30);
  for(const f of filas){
   expect(f.source,`${f.analyte}: sin fuente`).toBeTruthy();
   expect(String(f.source).length,`${f.analyte}: fuente demasiado corta para ser una cita`).toBeGreaterThan(20);
   // Lo que el hallazgo llamaba «umbrales de demostración»: si volviera una fuente así, esto la caza.
   expect(f.source,`${f.analyte}: fuente de demostración`).not.toMatch(/demostraci|placeholder|TODO|TBD|ejemplo/i);
  }
 });

 it("el borde crítico es INCLUSIVO: el valor exacto del corte ya es crítico",()=>{
  // Decidido en la auditoría multiagente y es la regla que un médico espera: un potasio de 6,5 no es «casi» crítico.
  const filas=labReferenceRanges();
  const k=filas.find(f=>f.analyte==="POTASSIUM");
  expect(k,"POTASSIUM debe estar en el catálogo").toBeDefined();
  const alto=k!.criticalHigh;
  expect(classifyLab("POTASSIUM",String(alto)).critical,`${alto} mEq/L es el borde: debe ser crítico`).toBe(true);
 });

 it("un valor que no se puede interpretar es UNKNOWN, nunca NORMAL",()=>{
  // La mitad que importa de todo clasificador: no afirmar normalidad cuando no se sabe.
  for(const v of ["","abc","--"]){
   const r=classifyLab("POTASSIUM",v);
   expect(r.status,`«${v}» no es normal: es desconocido`).not.toBe("NORMAL");
  }
 });
});

describe("Signos vitales: el clasificador no afirma normalidad sin saber — R02a-ALG-04",()=>{
 it("un tipo de signo sin regla devuelve UNKNOWN, no NORMAL",()=>{
  const r=classifyVital("UN_SIGNO_QUE_NO_EXISTE","100");
  expect(r.status,"sin regla no hay normalidad que afirmar").toBe("UNKNOWN");
 });
 it("WEIGHT y HEIGHT siguen SIN clasificar, y lo dicen en vez de inventar un rango",()=>{
  // ALG-04 señalaba que no estaban implementados. Siguen sin estarlo a propósito: un peso «normal» exige percentiles por
  // edad y sexo (y en adulto, criterio de IMC), y fabricar un rango único sería peor que declarar que no se clasifica.
  for(const t of ["WEIGHT","HEIGHT"]){
   const r=classifyVital(t,"70");
   expect(r.status,`${t} no debe fingir una clasificación`).toBe("UNKNOWN");
  }
 });
});

describe("Inventario de algoritmos: la ficha existe para todo lo que el sistema calcula — R09-F02",()=>{
 it("cada ficha declara fórmula, unidades, salida, fuente, dónde se validó y sus límites",()=>{
  expect(ALGORITHM_SPECS.length,"el inventario no debería encogerse").toBeGreaterThanOrEqual(11);
  for(const s of ALGORITHM_SPECS){
   expect(s.formula,`${s.id}: sin fórmula`).toBeTruthy();
   expect(s.output,`${s.id}: sin descripción de la salida`).toBeTruthy();
   expect(s.source.length,`${s.id}: la fuente debe ser una cita, no una etiqueta`).toBeGreaterThan(15);
   expect(s.validatedIn,`${s.id}: sin población de validación, el número no se puede aplicar`).toBeTruthy();
   expect(s.limits,`${s.id}: sin límites declarados, la ficha promete más de lo que el algoritmo sabe`).toBeTruthy();
   expect(Object.keys(s.units).length,`${s.id}: sin unidades, el valor es ambiguo`).toBeGreaterThan(0);
  }
 });
 it("los cuatro clasificadores por umbral que el anexo llamó «nivel 3» tienen ficha",()=>{
  // Era el hueco real de R09-F02: el inventario cubría los 11 calculadores con recibo y dejaba fuera los
  // clasificadores (laboratorio, delta, signos vitales) y las metas de tendencia, que son lo que un médico ve a diario.
  for(const id of["CLASSIFY-LAB","DELTA-CHECK","CLASSIFY-VITAL","TREND-GOALS"])
   expect(SPEC_BY_ID[id],`falta la ficha de ${id}`).toBeDefined();
 });
});
