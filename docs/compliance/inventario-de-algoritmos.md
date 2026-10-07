# Inventario de algoritmos clínicos — fórmula, unidades, umbrales y fuente

> **GENERADO desde el código.** No editar a mano: `pnpm algorithms:inventory` lo reescribe y
> `tests/v22/algorithm-inventory.test.ts` falla si el fichero y el código no coinciden.
> Autoridad: auditoría 2026-09-19, anexo R09 (R09-F02).

Los umbrales de esta página no son una transcripción: `packages/clinical-algorithm-specs` **importa** las
constantes de cada implementación, así que si un umbral cambia en el código, cambia aquí. No hay dos copias.

**Esto no es validación clínica.** Dice qué calcula el código, con qué unidades, qué cotas rechaza y de qué
fuente sale. Que la fórmula sea la correcta para la población atendida lo tiene que decir un médico: es una de
las condiciones de admisión a producción de ADR-0300 que solo el dueño puede cerrar.

## Tasa de filtración glomerular estimada (adulto) — `CKD-EPI-2021`

- **Fórmula:** eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^(-1.200) × 0.9938^edad × (1.012 si mujer); κ=0.7 mujer / 0.9 hombre; α=-0.241 mujer / -0.302 hombre
- **Unidades esperadas:** `creatinina` en mg/dL; `edad` en años; `sexo` en MALE | FEMALE
- **Cotas y umbrales (importados del código):** `{"scrMgDl":[0.1,25],"ageYears":[18,120]}`
- **Qué devuelve:** mL/min/1.73 m², categoría G (G1–G5) y —decisión D2 del cotejo de guías— estadio C-G-A con el riesgo de la tabla de KDIGO cuando hay albuminuria; sin ella se declara incompleto en vez de afirmar riesgo. Fuera de las cotas NO se calcula: devuelve el motivo.
- **Fuente primaria:** Inker LA et al., New England Journal of Medicine 2021;385:1737-1749
- **Población en que se validó:** Adultos (≥18 años). Ecuación SIN coeficiente de raza, por decisión de la propia fuente.
- **Lo que NO hace:** No es válida en lesión renal aguda (la creatinina no está en equilibrio), ni en embarazo, ni en extremos de masa muscular. No sustituye la medición directa cuando la decisión depende de precisión (p. ej. dosis de quimioterapia).
- **Expuesto por:** `apps/web/app/api/v1/patients/[patientId]/egfr/route.ts`

## Tasa de filtración glomerular estimada (pediátrica) — `SCHWARTZ-BEDSIDE-2009`

- **Fórmula:** eGFR = 0.413 × talla(cm) / creatinina(mg/dL)
- **Unidades esperadas:** `talla` en cm; `creatinina` en mg/dL; `edad` en años
- **Cotas y umbrales (importados del código):** `{"edad":[1,17],"talla":[40,200]}`
- **Qué devuelve:** mL/min/1.73 m². Sin talla NO se calcula: la fórmula la exige y suponerla inventaría el resultado.
- **Fuente primaria:** Schwartz GJ et al., Journal of the American Society of Nephrology 2009;20:629-637
- **Población en que se validó:** Niños y adolescentes de 1 a 17 años con enfermedad renal crónica.
- **Lo que NO hace:** No aplicable a menores de 1 año ni a adultos. Derivada en ERC: en función renal normal sobreestima.
- **Expuesto por:** `apps/web/app/api/v1/patients/[patientId]/egfr/route.ts`

## Gradiente alvéolo-arterial de oxígeno — `AA-GRADIENT`

- **Fórmula:** PAO₂ = FiO₂ × (Patm − PH₂O) − PaCO₂/R ; gradiente = PAO₂ − PaO₂ ; esperado ≈ (edad/4) + 4
- **Unidades esperadas:** `PaO2` en mmHg; `PaCO2` en mmHg; `FiO2` en fracción (0–1); `altitud` en m; `edad` en años
- **Cotas y umbrales (importados del código):** `{"ph":[6.5,7.9],"pco2":[10,150],"hco3":[2,60]}`
- **Qué devuelve:** Gradiente en mmHg y comparación con el esperado por edad. Corrige la presión atmosférica por altitud (ISO 2533).
- **Fuente primaria:** Mellemgaard K, Acta Physiologica Scandinavica 1966;67:10-20; atmósfera estándar ISO 2533
- **Población en que se validó:** Adultos respirando aire ambiente o con FiO₂ conocida, en estado estable.
- **Lo que NO hace:** Exige una gasometría ARTERIAL del mismo momento: con sangre venosa el número no significa nada. El cociente respiratorio se asume 0.8.
- **Expuesto por:** `apps/web/app/api/v1/patients/[patientId]/aa-gradient/route.ts`

## Interpretación ácido-base con compensación y anión gap — `ACID-BASE`

- **Fórmula:** Henderson-Hasselbalch (pH = 6.1 + log₁₀(HCO₃⁻/(0.03×PaCO₂))) para coherencia del panel; reglas de compensación esperada por trastorno; anión gap = Na⁺ − (Cl⁻ + HCO₃⁻), corregido por albúmina; delta-delta
- **Unidades esperadas:** `pH` en adimensional; `PaCO2` en mmHg; `HCO3` en mEq/L; `Na` en mEq/L; `Cl` en mEq/L; `albumina` en g/dL
- **Cotas y umbrales (importados del código):** `{"gases":{"ph":[6.5,7.9],"pco2":[10,150],"hco3":[2,60]},"toleranciaHH":0.05}`
- **Qué devuelve:** Trastorno primario, si la compensación es la esperada, y si hay un trastorno mixto. Un panel internamente incoherente se RECHAZA (GAS_PANEL_INCONSISTENT) en vez de interpretarse.
- **Fuente primaria:** Henderson-Hasselbalch; reglas de compensación de Narins RG y Emmett M, Medicine 1980;59:161-187
- **Población en que se validó:** Adultos. La distinción agudo/crónico en los trastornos respiratorios exige saber el tiempo de evolución.
- **Lo que NO hace:** No decide la causa ni la conducta. Sin albúmina, el anión gap corregido no se reporta en lugar de asumir un valor normal.
- **Expuesto por:** **ninguna ruta emite recibo con este id**

## Gravedad de neumonía adquirida en la comunidad — `CURB-65`

- **Fórmula:** 1 punto por: confusión, urea > 7 mmol/L, frecuencia respiratoria ≥ 30, presión (sistólica < 90 o diastólica ≤ 60), edad ≥ 65
- **Unidades esperadas:** `urea` en mmol/L; `frecuenciaRespiratoria` en respiraciones/min; `presionSistolica` en mmHg; `presionDiastolica` en mmHg; `edad` en años
- **Cotas y umbrales (importados del código):** `{"edadMinima":16,"cotas":{"bun":[1,300],"respRate":[4,80],"systolic":[40,300],"diastolic":[10,200],"ageYears":[0,130]}}`
- **Qué devuelve:** 0–5 puntos y estrato de riesgo. Con criterios no medidos NO se emite una puntuación tranquilizadora: se dice qué falta.
- **Fuente primaria:** Lim WS et al., Thorax 2003;58:377-382
- **Población en que se validó:** Adultos con neumonía adquirida en la comunidad. NO validado en pediatría ni en neumonía nosocomial.
- **Lo que NO hace:** No incluye oxigenación ni comorbilidad: una saturación baja con CURB-65 de 0 sigue siendo una neumonía grave. Es una ayuda a la decisión de ingreso, no la decisión.
- **Expuesto por:** **ninguna ruta emite recibo con este id**

## Riesgo tromboembólico en fibrilación auricular no valvular (CHA₂DS₂-VA) — `CHA2DS2-VA-ESC-2024`

- **Fórmula:** Insuficiencia cardiaca 1, hipertensión 1, edad ≥75 2, diabetes 1, ictus/AIT/embolia 2, enfermedad vascular 1, edad 65–74 1, sexo femenino 1
- **Unidades esperadas:** `edad` en años; `sexo` en MALE | FEMALE
- **Cotas y umbrales (importados del código):** `{"maximo":9}`
- **Qué devuelve:** 0–9 puntos con el riesgo anual asociado. La indicación de anticoagular es del médico.
- **Fuente primaria:** 2024 ESC Guidelines for the management of atrial fibrillation (European Heart Journal 2024) — decisión D1 del cotejo de guías: se adopta CHA₂DS₂-VA, que ELIMINA la categoría de sexo. Alternativa declarada y no implementada: ACC/AHA/ACCP/HRS 2023 (CHA₂DS₂-VASc, Lip GYH et al., Chest 2010;137:263-272).
- **Población en que se validó:** Adultos con fibrilación auricular NO valvular.
- **Lo que NO hace:** No aplica a fibrilación valvular ni a prótesis mecánicas (esas anticoagulan por indicación propia). No estima riesgo hemorrágico: eso es otra escala.
- **Expuesto por:** `apps/web/app/api/v1/patients/[patientId]/cha2ds2vasc/route.ts`

## Índice de fibrosis hepática — `FIB-4`

- **Fórmula:** FIB-4 = edad × AST / (plaquetas(10⁹/L) × √ALT)
- **Unidades esperadas:** `edad` en años; `AST` en U/L; `ALT` en U/L; `plaquetas` en 10⁹/L
- **Cotas y umbrales (importados del código):** `{"corteBajo":1.3,"corteAlto":2.67}`
- **Qué devuelve:** Índice con tres estratos (fibrosis avanzada improbable / indeterminado / probable).
- **Fuente primaria:** Sterling RK et al., Hepatology 2006;43:1317-1325
- **Población en que se validó:** Adultos con hepatitis crónica (derivado en coinfección VIH/VHC).
- **Lo que NO hace:** El estrato indeterminado es frecuente y NO se debe reportar como normal. Menos fiable por debajo de 35 años y por encima de 65.
- **Expuesto por:** `apps/web/app/api/v1/patients/[patientId]/fib4/route.ts`

## Índice de comorbilidad de Charlson — `CHARLSON`

- **Fórmula:** Suma ponderada de 19 comorbilidades (1, 2, 3 o 6 puntos) más puntos por edad
- **Unidades esperadas:** `edad` en años; `diagnosticos` en códigos CIE-10
- **Cotas y umbrales (importados del código):** `{"maximo":37}`
- **Qué devuelve:** Índice de comorbilidad y supervivencia estimada a 10 años.
- **Fuente primaria:** Charlson ME et al., Journal of Chronic Diseases 1987;40:373-383; mapeo a CIE-10 de Quan H et al., Medical Care 2005;43:1130-1139
- **Población en que se validó:** Adultos hospitalizados (cohorte original de medicina interna).
- **Lo que NO hace:** Depende de que el diagnóstico esté CODIFICADO: un problema real sin código no puntúa, así que un índice bajo puede reflejar mala codificación y no buena salud.
- **Expuesto por:** `apps/web/app/api/v1/patients/[patientId]/charlson/route.ts`

## Escala de alerta temprana NEWS2 — `NEWS2-RCP-2017`

- **Fórmula:** Suma de 0–3 puntos por frecuencia respiratoria, saturación (escala 1 o 2), oxígeno suplementario, presión sistólica, frecuencia cardiaca, nivel de conciencia y temperatura
- **Unidades esperadas:** `frecuenciaRespiratoria` en respiraciones/min; `saturacion` en %; `presionSistolica` en mmHg; `frecuenciaCardiaca` en latidos/min; `temperatura` en °C
- **Cotas y umbrales (importados del código):** `{"maximo":20,"umbralRespuestaUrgente":7}`
- **Qué devuelve:** 0–20 puntos con el nivel de respuesta clínica sugerido. Con signos vitales vencidos NO se emite una puntuación: una puntuación de hace ocho horas no describe al paciente de ahora.
- **Fuente primaria:** Royal College of Physicians, National Early Warning Score (NEWS) 2, 2017
- **Población en que se validó:** Adultos hospitalizados. NO validado en pediatría ni en embarazo.
- **Lo que NO hace:** Escala 2 de saturación solo si hay objetivo de saturación prescrito (EPOC con retención). No sustituye el juicio clínico ante un paciente que 'pinta mal' con puntuación baja.
- **Expuesto por:** `apps/web/app/api/v1/patients/[patientId]/news2/route.ts`

## MELD / MELD-Na — gravedad en hepatopatía avanzada — `MELD`

- **Fórmula:** MELD = 3.78·ln(bilirrubina) + 11.2·ln(INR) + 9.57·ln(creatinina) + 6.43 (valores acotados por abajo a 1.0; creatinina a 4.0 si hay diálisis). MELD-Na añade la corrección por sodio de Kim 2008.
- **Unidades esperadas:** `bilirrubina` en mg/dL; `INR` en adimensional; `creatinina` en mg/dL; `sodio` en mEq/L
- **Cotas y umbrales (importados del código):** `{"sodioMeldNa":[125,137],"pisoDeValores":1,"creatininaConDialisis":4}`
- **Qué devuelve:** Puntuación de gravedad con la mortalidad a tres meses de la tabla original, y la versión usada (MELD-2001 o MELD-Na-2016) declarada en el resultado.
- **Fuente primaria:** Kamath PS et al., Hepatology 2001;33:464-470; tramos de mortalidad de Wiesner RH et al., Gastroenterology 2003;124:91-96; corrección por sodio de Kim WR et al., NEJM 2008;359:1018-1026
- **Población en que se validó:** Adultos con hepatopatía crónica avanzada.
- **Lo que NO hace:** ADVERTENCIA PERMANENTE: la ASIGNACIÓN de hígado para trasplante usa MELD 3.0 (Kim WR et al., Gastroenterology 2021) desde 2023, que añade albúmina, sodio y sexo y acota la creatinina a 3.0. Este sistema NO implementa MELD 3.0 y su resultado no debe usarse para priorizar trasplante. Implementarlo es una decisión del dueño.
- **Expuesto por:** `apps/web/app/api/v1/patients/[patientId]/meld/route.ts`

## Clasificación de un resultado de laboratorio contra su rango de referencia — `CLASSIFY-LAB`

- **Fórmula:** Se elige la fila de referencia que corresponde al estrato del paciente (edad, sexo, embarazo, ayuno) y se compara el valor convertido a la unidad canónica contra los cuatro cortes [críticoBajo, normalBajo, normalAlto, críticoAlto]. Los bordes son INCLUSIVOS: el valor exacto del corte crítico ya es crítico.
- **Unidades esperadas:** `valor` en la unidad canónica del analito (se convierte si llega en otra); sin unidad interpretable el resultado es UNKNOWN
- **Cotas y umbrales (importados del código):** `{"analitos":30,"cortesPorAnalito":4}`
- **Qué devuelve:** NORMAL | ABNORMAL | CRITICAL | UNKNOWN, con el rango aplicado, el estrato elegido, su fuente y los datos del paciente que FALTABAN para estratificar mejor. UNKNOWN no es NORMAL: es que no se pudo clasificar.
- **Fuente primaria:** Fuente POR ANALITO Y POR ESTRATO, declarada en cada fila de `lab-reference` (WHO 2011, Tietz Clinical Guide to Laboratory Tests, Nathan & Oski para neonato, ADA 2024 para glucosa, EASL 2016 para transaminasas, entre otras). No hay una fuente única del clasificador: la tiene cada rango.
- **Población en que se validó:** Los rangos son de población general adulta salvo los estratos declarados (pediátrico, embarazo, neonato). Un valor fuera del estrato cubierto se clasifica con el estrato por omisión y la salida DICE qué dato faltaba.
- **Lo que NO hace:** No interpreta el resultado en contexto clínico: un potasio de 6,0 en una muestra hemolizada es un artefacto, y el clasificador no lo sabe. Tampoco aplica factores de corrección (calcio por albúmina). La validación clínica de los cortes para la población atendida sigue pendiente (R09-020, R09-025).
- **Expuesto por:** **ninguna ruta emite recibo con este id**

## Cambio agudo entre dos resultados del mismo analito — `DELTA-CHECK`

- **Fórmula:** Se compara el resultado nuevo con el previo por diferencia absoluta y por razón (nuevo/previo), cada criterio dentro de SU ventana temporal. La magnitud se redondea a la precisión con que el laboratorio reporta el analito antes de comparar, para que dos deltas clínicamente idénticos no den veredictos distintos por la aritmética de coma flotante.
- **Unidades esperadas:** `previo` en la unidad canónica del analito; `nuevo` en la misma unidad; `ventana` en días
- **Cotas y umbrales (importados del código):** `{"ventanaPorAnalito":{"CREATININE":7,"HEMOGLOBIN":14,"SODIUM":3,"POTASSIUM":3,"PLATELETS":14,"CALCIUM":7,"GLUCOSE":3},"criterioAbsolutoCreatininaDias":2}`
- **Qué devuelve:** CRITICAL con la nota clínica y LA FUENTE del umbral que se cumplió, o NONE. Fuera de ventana NO se evalúa y se dice: una creatinina que se duplica en siete días es lesión aguda; en tres años es progresión crónica, y el aviso sería ruido.
- **Fuente primaria:** Creatinina: KDIGO 2012, Clinical Practice Guideline for Acute Kidney Injury §2.1. Sodio: límite de velocidad de corrección de la hiponatremia (guía europea, Spasovski et al. 2014). Plaquetas: criterio de recuento del score 4T (Lo, Juhl & Warkentin, 2006). Hemoglobina, potasio, calcio y glucosa: criterios OPERATIVOS de este sistema, declarados como tales en el código porque NO existe un corte publicado de delta para ellos.
- **Población en que se validó:** KDIGO se validó en adultos hospitalizados y ambulatorios; los criterios operativos no están validados en ninguna población y así se declaran.
- **Lo que NO hace:** Compara dos puntos, no una tendencia. No sabe si el previo era el basal del paciente o ya era patológico, lo que importa en el criterio relativo de KDIGO. Un delta de calcio sin albúmina es orientativo.
- **Expuesto por:** **ninguna ruta emite recibo con este id**

## Clasificación de un signo vital por franja de edad — `CLASSIFY-VITAL`

- **Fórmula:** Se convierte el valor a la unidad canónica del signo y se compara contra la franja que corresponde a la edad del paciente. Sin edad se aplica la franja adulta y la salida lo declara.
- **Unidades esperadas:** `BP` en mmHg; `HR` en lpm; `RESP` en rpm; `SPO2` en %; `WEIGHT` en kg; `HEIGHT` en cm; `TEMP` en °C
- **Cotas y umbrales (importados del código):** `{"signosConRegla":7}`
- **Qué devuelve:** NORMAL | ABNORMAL | CRITICAL | UNKNOWN con su interpretación en texto. Un tipo de signo SIN regla devuelve UNKNOWN, nunca NORMAL.
- **Fuente primaria:** Franjas pediátricas: American Heart Association, 2020 Guidelines for CPR and Emergency Cardiovascular Care, sección pediátrica (PALS) — referencia ORIENTATIVA, así declarada en el código. Franjas adultas: valores de alarma de uso corriente en monitorización clínica, SIN una guía única que las fije; se declara así en lugar de atribuirles una fuente que no tienen, y es la mitad de esta ficha que más necesita validación médica (R09-020, R09-025).
- **Población en que se validó:** NO validado. Es la limitación más importante de esta ficha y está declarada en el propio módulo desde el primer día.
- **Lo que NO hace:** PESO y TALLA no se clasifican a propósito: un peso «normal» exige percentiles por edad y sexo en pediatría, y criterio de IMC en adulto, así que fabricar un rango único sería peor que declarar que no se clasifica. La clasificación no considera el contexto (fiebre, dolor, ansiedad) ni la medicación (betabloqueo).
- **Expuesto por:** **ninguna ruta emite recibo con este id**

## Metas de los gráficos de tendencia — `TREND-GOALS`

- **Fórmula:** Cada métrica de tendencia lleva su meta por omisión y la población en que esa meta aplica. La pantalla NO pinta una franja de meta cuando la métrica no tiene umbral universal.
- **Unidades esperadas:** `HbA1c` en %; `glucosa` en mg/dL; `LDL` en mg/dL; `creatinina` en mg/dL; `presionArterial` en mmHg; `IMC` en kg/m²
- **Cotas y umbrales (importados del código):** `{"metas":6,"avisoDeIndividualizacion":"Meta por omisión; la del paciente la fija su médico."}`
- **Qué devuelve:** La meta por omisión y su fuente, con el aviso de que la meta del paciente la fija su médico. Donde no hay meta universal (LDL, creatinina) se declara y no se dibuja ninguna franja.
- **Fuente primaria:** HbA1c y glucosa preprandial: American Diabetes Association, Standards of Care in Diabetes (Glycemic Targets). Presión arterial: ACC/AHA 2017. IMC: clasificación de la OMS. LDL: las guías (ACC/AHA y ESC/EAS) estratifican por categoría de riesgo y NO existe umbral único, así que no se publica uno. Creatinina: sin meta universal — es una tendencia, no un objetivo.
- **Población en que se validó:** Adultos no embarazados, que es la población de las guías citadas. En embarazo, pediatría y adulto mayor frágil las metas son distintas y este sistema no las individualiza.
- **Lo que NO hace:** Son metas POR OMISIÓN, no del paciente. Una meta de HbA1c <7 % es inapropiada en un adulto mayor con hipoglucemias, y el sistema no lo sabe: por eso cada meta viaja con el aviso de individualización en vez de presentarse como la meta del paciente.
- **Expuesto por:** **ninguna ruta emite recibo con este id**

## Huecos declarados

Algoritmos con ficha: **14**. Ids que el código emite en un recibo de cálculo: **8**.

Todo id que viaja en un recibo de cálculo tiene su ficha.

Las calculadoras que **no** emiten recibo (IMC, conversiones de unidad, clasificadores de rango) quedan fuera de
este inventario por ahora: su resultado no es una recomendación de conducta. Si alguna pasa a emitir recibo, el
guardarraíl la reclamará aquí automáticamente.
