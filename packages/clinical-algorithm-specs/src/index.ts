// Auditoría 2026-09-19, anexo R09 (R09-F02) — FICHA TÉCNICA POR ALGORITMO CLÍNICO.
//
// EL HALLAZGO. «Ningún documento de docs/ transcribe fórmula, unidades, umbrales ni fuente primaria de los algoritmos
// clínicos.» Para que un médico pueda validar lo que el sistema calcula necesita exactamente eso, y hasta ahora tenía que
// leer TypeScript. El remedio que el anexo admite es «una ficha por algoritmo en docs/ **o generarla desde el código**».
//
// POR QUÉ SE GENERA Y NO SE ESCRIBE. Una ficha escrita a mano deriva: lo he visto cuatro veces en esta misma remediación
// —la expectativa del drill, la ruta de los value sets, el «27 migraciones» del runbook, el testid `result-action`—. Así
// que la ficha se genera (`pnpm algorithms:inventory`) y, más importante, **los umbrales no se copian aquí: se IMPORTAN de
// la implementación**. Si mañana alguien cambia `EGFR_BOUNDS`, la ficha cambia con él porque es el mismo objeto; no hay una
// segunda copia que pueda quedarse atrás.
//
// LO QUE ESTA FICHA NO ES. No es validación clínica. Dice qué calcula el código, con qué unidades, qué cotas rechaza y de
// qué fuente sale; que la fórmula sea la correcta para la población atendida lo tiene que decir un médico (ADR-0300).
import{EGFR_BOUNDS,SCHWARTZ_AGE_RANGE,SCHWARTZ_HEIGHT_CM_RANGE}from"../../renal-function/src";
import{GAS_BOUNDS,HH_TOLERANCE}from"../../acid-base/src";
import{CURB65_MIN_AGE_YEARS,CURB65_BOUNDS}from"../../pneumonia-severity/src";
import{MELD_NA_SODIUM_BOUNDS}from"../../meld/src";
import{DELTA_WINDOW_DAYS,VITAL_UNITS,labReferenceRanges}from"../../lab-reference/src";
import{CARE_GOALS,INDIVIDUALIZATION_NOTICE}from"../../care-goals/src";

export type AlgorithmSpec=Readonly<{
 /** Identificador que viaja en el recibo de cálculo (`calcReceipt`). Es la clave que ata ficha, código y auditoría. */
 id:string;
 name:string;
 /** Fórmula o regla, en notación legible por un clínico. */
 formula:string;
 /** Unidad esperada por cada entrada. Una fórmula sin unidades es una trampa: mg/dL y µmol/L difieren en 88,4. */
 units:Readonly<Record<string,string>>;
 /** Cotas y umbrales REFERENCIADOS de la implementación, nunca transcritos. */
 bounds:unknown;
 /** Qué devuelve y cómo se interpreta. */
 output:string;
 /** Fuente primaria: el artículo o la norma, no un libro de texto. */
 source:string;
 /** Población en la que la fuente lo validó. Fuera de ella, el resultado no es aplicable aunque el número salga. */
 validatedIn:string;
 /** Lo que el algoritmo NO hace, para que nadie lo asuma. */
 limits:string;
}>;

export const ALGORITHM_SPECS:readonly AlgorithmSpec[]=[
 {
  id:"CKD-EPI-2021",name:"Tasa de filtración glomerular estimada (adulto)",
  formula:"eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^(-1.200) × 0.9938^edad × (1.012 si mujer); κ=0.7 mujer / 0.9 hombre; α=-0.241 mujer / -0.302 hombre",
  units:{creatinina:"mg/dL",edad:"años",sexo:"MALE | FEMALE"},
  bounds:EGFR_BOUNDS,
  output:"mL/min/1.73 m², categoría G (G1–G5) y —decisión D2 del cotejo de guías— estadio C-G-A con el riesgo de la tabla de KDIGO cuando hay albuminuria; sin ella se declara incompleto en vez de afirmar riesgo. Fuera de las cotas NO se calcula: devuelve el motivo.",
  source:"Inker LA et al., New England Journal of Medicine 2021;385:1737-1749",
  validatedIn:"Adultos (≥18 años). Ecuación SIN coeficiente de raza, por decisión de la propia fuente.",
  limits:"No es válida en lesión renal aguda (la creatinina no está en equilibrio), ni en embarazo, ni en extremos de masa muscular. No sustituye la medición directa cuando la decisión depende de precisión (p. ej. dosis de quimioterapia).",
 },
 {
  id:"SCHWARTZ-BEDSIDE-2009",name:"Tasa de filtración glomerular estimada (pediátrica)",
  formula:"eGFR = 0.413 × talla(cm) / creatinina(mg/dL)",
  units:{talla:"cm",creatinina:"mg/dL",edad:"años"},
  bounds:{edad:SCHWARTZ_AGE_RANGE,talla:SCHWARTZ_HEIGHT_CM_RANGE},
  output:"mL/min/1.73 m². Sin talla NO se calcula: la fórmula la exige y suponerla inventaría el resultado.",
  source:"Schwartz GJ et al., Journal of the American Society of Nephrology 2009;20:629-637",
  validatedIn:"Niños y adolescentes de 1 a 17 años con enfermedad renal crónica.",
  limits:"No aplicable a menores de 1 año ni a adultos. Derivada en ERC: en función renal normal sobreestima.",
 },
 {
  id:"AA-GRADIENT",name:"Gradiente alvéolo-arterial de oxígeno",
  formula:"PAO₂ = FiO₂ × (Patm − PH₂O) − PaCO₂/R ; gradiente = PAO₂ − PaO₂ ; esperado ≈ (edad/4) + 4",
  units:{PaO2:"mmHg",PaCO2:"mmHg",FiO2:"fracción (0–1)",altitud:"m",edad:"años"},
  bounds:GAS_BOUNDS,
  output:"Gradiente en mmHg y comparación con el esperado por edad. Corrige la presión atmosférica por altitud (ISO 2533).",
  source:"Mellemgaard K, Acta Physiologica Scandinavica 1966;67:10-20; atmósfera estándar ISO 2533",
  validatedIn:"Adultos respirando aire ambiente o con FiO₂ conocida, en estado estable.",
  limits:"Exige una gasometría ARTERIAL del mismo momento: con sangre venosa el número no significa nada. El cociente respiratorio se asume 0.8.",
 },
 {
  id:"ACID-BASE",name:"Interpretación ácido-base con compensación y anión gap",
  formula:"Henderson-Hasselbalch (pH = 6.1 + log₁₀(HCO₃⁻/(0.03×PaCO₂))) para coherencia del panel; reglas de compensación esperada por trastorno; anión gap = Na⁺ − (Cl⁻ + HCO₃⁻), corregido por albúmina; delta-delta",
  units:{pH:"adimensional",PaCO2:"mmHg",HCO3:"mEq/L",Na:"mEq/L",Cl:"mEq/L",albumina:"g/dL"},
  bounds:{gases:GAS_BOUNDS,toleranciaHH:HH_TOLERANCE},
  output:"Trastorno primario, si la compensación es la esperada, y si hay un trastorno mixto. Un panel internamente incoherente se RECHAZA (GAS_PANEL_INCONSISTENT) en vez de interpretarse.",
  source:"Henderson-Hasselbalch; reglas de compensación de Narins RG y Emmett M, Medicine 1980;59:161-187",
  validatedIn:"Adultos. La distinción agudo/crónico en los trastornos respiratorios exige saber el tiempo de evolución.",
  limits:"No decide la causa ni la conducta. Sin albúmina, el anión gap corregido no se reporta en lugar de asumir un valor normal.",
 },
 {
  id:"CURB-65",name:"Gravedad de neumonía adquirida en la comunidad",
  formula:"1 punto por: confusión, urea > 7 mmol/L, frecuencia respiratoria ≥ 30, presión (sistólica < 90 o diastólica ≤ 60), edad ≥ 65",
  units:{urea:"mmol/L",frecuenciaRespiratoria:"respiraciones/min",presionSistolica:"mmHg",presionDiastolica:"mmHg",edad:"años"},
  bounds:{edadMinima:CURB65_MIN_AGE_YEARS,cotas:CURB65_BOUNDS},
  output:"0–5 puntos y estrato de riesgo. Con criterios no medidos NO se emite una puntuación tranquilizadora: se dice qué falta.",
  source:"Lim WS et al., Thorax 2003;58:377-382",
  validatedIn:"Adultos con neumonía adquirida en la comunidad. NO validado en pediatría ni en neumonía nosocomial.",
  limits:"No incluye oxigenación ni comorbilidad: una saturación baja con CURB-65 de 0 sigue siendo una neumonía grave. Es una ayuda a la decisión de ingreso, no la decisión.",
 },
 {
  id:"CHA2DS2-VA-ESC-2024",name:"Riesgo tromboembólico en fibrilación auricular no valvular (CHA₂DS₂-VA)",
  formula:"Insuficiencia cardiaca 1, hipertensión 1, edad ≥75 2, diabetes 1, ictus/AIT/embolia 2, enfermedad vascular 1, edad 65–74 1, sexo femenino 1",
  units:{edad:"años",sexo:"MALE | FEMALE"},
  bounds:{maximo:9},
  output:"0–9 puntos con el riesgo anual asociado. La indicación de anticoagular es del médico.",
  source:"2024 ESC Guidelines for the management of atrial fibrillation (European Heart Journal 2024) — decisión D1 del cotejo de guías: se adopta CHA₂DS₂-VA, que ELIMINA la categoría de sexo. Alternativa declarada y no implementada: ACC/AHA/ACCP/HRS 2023 (CHA₂DS₂-VASc, Lip GYH et al., Chest 2010;137:263-272).",
  validatedIn:"Adultos con fibrilación auricular NO valvular.",
  limits:"No aplica a fibrilación valvular ni a prótesis mecánicas (esas anticoagulan por indicación propia). No estima riesgo hemorrágico: eso es otra escala.",
 },
 {
  id:"FIB-4",name:"Índice de fibrosis hepática",
  formula:"FIB-4 = edad × AST / (plaquetas(10⁹/L) × √ALT)",
  units:{edad:"años",AST:"U/L",ALT:"U/L",plaquetas:"10⁹/L"},
  bounds:{corteBajo:1.3,corteAlto:2.67},
  output:"Índice con tres estratos (fibrosis avanzada improbable / indeterminado / probable).",
  source:"Sterling RK et al., Hepatology 2006;43:1317-1325",
  validatedIn:"Adultos con hepatitis crónica (derivado en coinfección VIH/VHC).",
  limits:"El estrato indeterminado es frecuente y NO se debe reportar como normal. Menos fiable por debajo de 35 años y por encima de 65.",
 },
 {
  id:"CHARLSON",name:"Índice de comorbilidad de Charlson",
  formula:"Suma ponderada de 19 comorbilidades (1, 2, 3 o 6 puntos) más puntos por edad",
  units:{edad:"años",diagnosticos:"códigos CIE-10"},
  bounds:{maximo:37},
  output:"Índice de comorbilidad y supervivencia estimada a 10 años.",
  source:"Charlson ME et al., Journal of Chronic Diseases 1987;40:373-383; mapeo a CIE-10 de Quan H et al., Medical Care 2005;43:1130-1139",
  validatedIn:"Adultos hospitalizados (cohorte original de medicina interna).",
  limits:"Depende de que el diagnóstico esté CODIFICADO: un problema real sin código no puntúa, así que un índice bajo puede reflejar mala codificación y no buena salud.",
 },
 {
  id:"NEWS2-RCP-2017",name:"Escala de alerta temprana NEWS2",
  formula:"Suma de 0–3 puntos por frecuencia respiratoria, saturación (escala 1 o 2), oxígeno suplementario, presión sistólica, frecuencia cardiaca, nivel de conciencia y temperatura",
  units:{frecuenciaRespiratoria:"respiraciones/min",saturacion:"%",presionSistolica:"mmHg",frecuenciaCardiaca:"latidos/min",temperatura:"°C"},
  bounds:{maximo:20,umbralRespuestaUrgente:7},
  output:"0–20 puntos con el nivel de respuesta clínica sugerido. Con signos vitales vencidos NO se emite una puntuación: una puntuación de hace ocho horas no describe al paciente de ahora.",
  source:"Royal College of Physicians, National Early Warning Score (NEWS) 2, 2017",
  validatedIn:"Adultos hospitalizados. NO validado en pediatría ni en embarazo.",
  limits:"Escala 2 de saturación solo si hay objetivo de saturación prescrito (EPOC con retención). No sustituye el juicio clínico ante un paciente que 'pinta mal' con puntuación baja.",
 },
 {
  id:"MELD",name:"MELD / MELD-Na — gravedad en hepatopatía avanzada",
  formula:"MELD = 3.78·ln(bilirrubina) + 11.2·ln(INR) + 9.57·ln(creatinina) + 6.43 (valores acotados por abajo a 1.0; creatinina a 4.0 si hay diálisis). MELD-Na añade la corrección por sodio de Kim 2008.",
  units:{bilirrubina:"mg/dL",INR:"adimensional",creatinina:"mg/dL",sodio:"mEq/L"},
  bounds:{sodioMeldNa:MELD_NA_SODIUM_BOUNDS,pisoDeValores:1.0,creatininaConDialisis:4.0},
  output:"Puntuación de gravedad con la mortalidad a tres meses de la tabla original, y la versión usada (MELD-2001 o MELD-Na-2016) declarada en el resultado.",
  source:"Kamath PS et al., Hepatology 2001;33:464-470; tramos de mortalidad de Wiesner RH et al., Gastroenterology 2003;124:91-96; corrección por sodio de Kim WR et al., NEJM 2008;359:1018-1026",
  validatedIn:"Adultos con hepatopatía crónica avanzada.",
  limits:"ADVERTENCIA PERMANENTE: la ASIGNACIÓN de hígado para trasplante usa MELD 3.0 (Kim WR et al., Gastroenterology 2021) desde 2023, que añade albúmina, sodio y sexo y acota la creatinina a 3.0. Este sistema NO implementa MELD 3.0 y su resultado no debe usarse para priorizar trasplante. Implementarlo es una decisión del dueño.",
 },
 // Auditoría 2026-09-19, anexo R09 (R09-F02) — LOS CUATRO QUE FALTABAN.
 //
 // El inventario cubría los once CALCULADORES (los que emiten recibo de cálculo) y dejaba fuera los CLASIFICADORES por
 // umbral y las metas de tendencia, que son justamente lo que un médico ve a diario: el color de un resultado, el aviso
 // de un delta, el estado de un signo vital y la meta de un gráfico. Eran las cuatro filas que el anexo llamaba
 // «nivel 3». Sus umbrales se IMPORTAN, igual que el resto: `labReferenceRanges()`, `DELTA_WINDOW_DAYS`, `VITAL_UNITS`
 // y `CARE_GOALS` son los mismos objetos que ejecuta el sistema, no copias.
 {
  id:"CLASSIFY-LAB",name:"Clasificación de un resultado de laboratorio contra su rango de referencia",
  formula:"Se elige la fila de referencia que corresponde al estrato del paciente (edad, sexo, embarazo, ayuno) y se compara el valor convertido a la unidad canónica contra los cuatro cortes [críticoBajo, normalBajo, normalAlto, críticoAlto]. Los bordes son INCLUSIVOS: el valor exacto del corte crítico ya es crítico.",
  units:{valor:"la unidad canónica del analito (se convierte si llega en otra); sin unidad interpretable el resultado es UNKNOWN"},
  bounds:{analitos:labReferenceRanges().length,cortesPorAnalito:4},
  output:"NORMAL | ABNORMAL | CRITICAL | UNKNOWN, con el rango aplicado, el estrato elegido, su fuente y los datos del paciente que FALTABAN para estratificar mejor. UNKNOWN no es NORMAL: es que no se pudo clasificar.",
  source:"Fuente POR ANALITO Y POR ESTRATO, declarada en cada fila de `lab-reference` (WHO 2011, Tietz Clinical Guide to Laboratory Tests, Nathan & Oski para neonato, ADA 2024 para glucosa, EASL 2016 para transaminasas, entre otras). No hay una fuente única del clasificador: la tiene cada rango.",
  validatedIn:"Los rangos son de población general adulta salvo los estratos declarados (pediátrico, embarazo, neonato). Un valor fuera del estrato cubierto se clasifica con el estrato por omisión y la salida DICE qué dato faltaba.",
  limits:"No interpreta el resultado en contexto clínico: un potasio de 6,0 en una muestra hemolizada es un artefacto, y el clasificador no lo sabe. Tampoco aplica factores de corrección (calcio por albúmina). La validación clínica de los cortes para la población atendida sigue pendiente (R09-020, R09-025).",
 },
 {
  id:"DELTA-CHECK",name:"Cambio agudo entre dos resultados del mismo analito",
  formula:"Se compara el resultado nuevo con el previo por diferencia absoluta y por razón (nuevo/previo), cada criterio dentro de SU ventana temporal. La magnitud se redondea a la precisión con que el laboratorio reporta el analito antes de comparar, para que dos deltas clínicamente idénticos no den veredictos distintos por la aritmética de coma flotante.",
  units:{previo:"la unidad canónica del analito",nuevo:"la misma unidad",ventana:"días"},
  bounds:{ventanaPorAnalito:DELTA_WINDOW_DAYS,criterioAbsolutoCreatininaDias:2},
  output:"CRITICAL con la nota clínica y LA FUENTE del umbral que se cumplió, o NONE. Fuera de ventana NO se evalúa y se dice: una creatinina que se duplica en siete días es lesión aguda; en tres años es progresión crónica, y el aviso sería ruido.",
  source:"Creatinina: KDIGO 2012, Clinical Practice Guideline for Acute Kidney Injury §2.1. Sodio: límite de velocidad de corrección de la hiponatremia (guía europea, Spasovski et al. 2014). Plaquetas: criterio de recuento del score 4T (Lo, Juhl & Warkentin, 2006). Hemoglobina, potasio, calcio y glucosa: criterios OPERATIVOS de este sistema, declarados como tales en el código porque NO existe un corte publicado de delta para ellos.",
  validatedIn:"KDIGO se validó en adultos hospitalizados y ambulatorios; los criterios operativos no están validados en ninguna población y así se declaran.",
  limits:"Compara dos puntos, no una tendencia. No sabe si el previo era el basal del paciente o ya era patológico, lo que importa en el criterio relativo de KDIGO. Un delta de calcio sin albúmina es orientativo.",
 },
 {
  id:"CLASSIFY-VITAL",name:"Clasificación de un signo vital por franja de edad",
  formula:"Se convierte el valor a la unidad canónica del signo y se compara contra la franja que corresponde a la edad del paciente. Sin edad se aplica la franja adulta y la salida lo declara.",
  // `VITAL_UNITS` lleva la unidad canónica y las aceptadas por signo; la ficha publica la CANÓNICA, que es la que el
  // valor tiene cuando se compara. Se deriva del mismo objeto en lugar de transcribirla.
  units:Object.fromEntries(Object.entries(VITAL_UNITS).map(([k,v])=>[k,v.canonical])),
  bounds:{signosConRegla:Object.keys(VITAL_UNITS).length},
  output:"NORMAL | ABNORMAL | CRITICAL | UNKNOWN con su interpretación en texto. Un tipo de signo SIN regla devuelve UNKNOWN, nunca NORMAL.",
  source:"Franjas pediátricas: American Heart Association, 2020 Guidelines for CPR and Emergency Cardiovascular Care, sección pediátrica (PALS) — referencia ORIENTATIVA, así declarada en el código. Franjas adultas: valores de alarma de uso corriente en monitorización clínica, SIN una guía única que las fije; se declara así en lugar de atribuirles una fuente que no tienen, y es la mitad de esta ficha que más necesita validación médica (R09-020, R09-025).",
  validatedIn:"NO validado. Es la limitación más importante de esta ficha y está declarada en el propio módulo desde el primer día.",
  limits:"PESO y TALLA no se clasifican a propósito: un peso «normal» exige percentiles por edad y sexo en pediatría, y criterio de IMC en adulto, así que fabricar un rango único sería peor que declarar que no se clasifica. La clasificación no considera el contexto (fiebre, dolor, ansiedad) ni la medicación (betabloqueo).",
 },
 {
  id:"TREND-GOALS",name:"Metas de los gráficos de tendencia",
  formula:"Cada métrica de tendencia lleva su meta por omisión y la población en que esa meta aplica. La pantalla NO pinta una franja de meta cuando la métrica no tiene umbral universal.",
  units:{HbA1c:"%",glucosa:"mg/dL",LDL:"mg/dL",creatinina:"mg/dL",presionArterial:"mmHg",IMC:"kg/m²"},
  bounds:{metas:CARE_GOALS.length,avisoDeIndividualizacion:INDIVIDUALIZATION_NOTICE},
  output:"La meta por omisión y su fuente, con el aviso de que la meta del paciente la fija su médico. Donde no hay meta universal (LDL, creatinina) se declara y no se dibuja ninguna franja.",
  source:"HbA1c y glucosa preprandial: American Diabetes Association, Standards of Care in Diabetes (Glycemic Targets). Presión arterial: ACC/AHA 2017. IMC: clasificación de la OMS. LDL: las guías (ACC/AHA y ESC/EAS) estratifican por categoría de riesgo y NO existe umbral único, así que no se publica uno. Creatinina: sin meta universal — es una tendencia, no un objetivo.",
  validatedIn:"Adultos no embarazados, que es la población de las guías citadas. En embarazo, pediatría y adulto mayor frágil las metas son distintas y este sistema no las individualiza.",
  limits:"Son metas POR OMISIÓN, no del paciente. Una meta de HbA1c <7 % es inapropiada en un adulto mayor con hipoglucemias, y el sistema no lo sabe: por eso cada meta viaja con el aviso de individualización en vez de presentarse como la meta del paciente.",
 },
];

/** Índice por id, que es la clave que viaja en el recibo de cálculo. */
export const SPEC_BY_ID:Readonly<Record<string,AlgorithmSpec>>=Object.freeze(
 Object.fromEntries(ALGORITHM_SPECS.map(s=>[s.id,s])));
