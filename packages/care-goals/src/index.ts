// Auditoría 2026-09-19, anexo R05a (R05a-F01) — METAS DE TENDENCIA: fuente, población y individualización.
//
// EL HALLAZGO. Las metas del plan de cuidado estaban ESCRITAS EN LA VISTA: `metric("HbA1c","Meta < 7%",…)`,
// `"Meta < 130/80"`, `"Meta < 25"`. Sin fuente y, lo que importa más, **sin población**: se presentaban como LA meta para
// cualquier paciente.
//
// POR QUÉ ESO ES UN PROBLEMA CLÍNICO Y NO DE ESTILO. Una HbA1c menor de 7 % es la meta razonable para la mayoría de los
// adultos no embarazados, y NO lo es para un anciano frágil, para alguien con hipoglucemias graves previas, con
// comorbilidad avanzada o con esperanza de vida limitada: en esa población el control estricto AUMENTA el riesgo de
// hipoglucemia grave, que mata. Mostrar «Meta < 7 %» en la pantalla de ese paciente no es un número impreciso: es empujar
// a una conducta que puede dañarlo. Lo mismo con la presión arterial, donde la meta depende de edad, riesgo cardiovascular
// y fragilidad.
//
// QUÉ SE HACE Y QUÉ NO. Este módulo declara la meta POR OMISIÓN de cada métrica con su fuente primaria, la población en la
// que aplica y las condiciones que exigen individualizarla. NO decide por el médico: la meta del paciente concreto la fija
// quien lo atiende, y el sistema tiene que dejar eso visible en vez de esconderlo detrás de un número.
export type CareGoal=Readonly<{
 metric:string;
 /** Meta por omisión, en el formato que se muestra. */
 defaultTarget:string;
 unit:string;
 /** Población en la que esa meta es la recomendada por la fuente. */
 appliesTo:string;
 /** Situaciones en las que la meta por omisión NO aplica y hay que individualizar. */
 individualizeWhen:readonly string[];
 source:string;
 /** Predicado de «en meta» para la meta por omisión; `null` cuando la métrica solo se sigue, sin meta. */
 meetsDefault:((value:number)=>boolean)|null;
}>;

export const CARE_GOALS:readonly CareGoal[]=[
 {
  metric:"HbA1c",defaultTarget:"< 7 %",unit:"%",
  appliesTo:"La mayoría de los adultos no embarazados con diabetes.",
  individualizeWhen:[
   "Adulto mayor frágil o con esperanza de vida limitada: una meta más laxa (< 8 %) reduce el riesgo de hipoglucemia grave.",
   "Antecedente de hipoglucemia grave o hipoglucemias inadvertidas.",
   "Comorbilidad avanzada o enfermedad cardiovascular establecida.",
   "Diabetes de larga evolución con dificultad para alcanzar la meta sin hipoglucemias.",
   "Embarazo: las metas son distintas y más estrictas; no aplica esta tabla.",
  ],
  source:"American Diabetes Association, Standards of Care in Diabetes (Glycemic Targets): meta < 7 % para la mayoría de adultos no embarazados, con metas menos estrictas en adultos mayores o con comorbilidad.",
  meetsDefault:(v)=>v<7,
 },
 {
  metric:"Presión arterial",defaultTarget:"< 130/80 mmHg",unit:"mmHg",
  appliesTo:"Adultos con hipertensión y riesgo cardiovascular elevado.",
  individualizeWhen:[
   "Adulto mayor frágil o con hipotensión ortostática: bajar demasiado aumenta caídas y síncope.",
   "Enfermedad renal crónica avanzada o diálisis.",
   "Embarazo: metas y fármacos distintos.",
  ],
  source:"ACC/AHA Guideline for the Prevention, Detection, Evaluation and Management of High Blood Pressure in Adults (2017): objetivo < 130/80 mmHg en adultos con riesgo elevado.",
  meetsDefault:(v)=>v<130, // se evalúa sobre la sistólica
 },
 {
  metric:"IMC",defaultTarget:"18.5 – 24.9",unit:"kg/m²",
  appliesTo:"Adultos. La clasificación de la OMS no aplica a menores de 18 años, que usan percentiles por edad y sexo.",
  individualizeWhen:[
   "Menores de 18 años: se usan percentiles por edad y sexo, no el rango del adulto.",
   "Embarazo, edema o ascitis: el peso no refleja masa corporal.",
   "Masa muscular alta (deportistas) o sarcopenia: el IMC clasifica mal en los dos extremos.",
   "Adulto mayor: un IMC algo mayor se asocia a mejor pronóstico; la meta del adulto joven no aplica sin más.",
  ],
  source:"Organización Mundial de la Salud, clasificación del índice de masa corporal en adultos.",
  meetsDefault:(v)=>v>=18.5&&v<25,
 },
 {
  metric:"Peso",defaultTarget:"Seguimiento, sin meta única",unit:"kg",
  appliesTo:"Todos. El peso se sigue como tendencia; su meta depende del objetivo clínico del paciente.",
  individualizeWhen:["Siempre: no existe un peso objetivo universal. La meta la fija el médico con el paciente."],
  source:"Sin fuente de meta universal: es una tendencia, no un umbral.",
  meetsDefault:null,
 },
];

export const goalFor=(metric:string):CareGoal|undefined=>CARE_GOALS.find(g=>g.metric===metric);
/** Aviso que la UI debe mostrar junto a cualquier meta por omisión. */
export const INDIVIDUALIZATION_NOTICE="Meta por omisión; la del paciente la fija su médico.";
