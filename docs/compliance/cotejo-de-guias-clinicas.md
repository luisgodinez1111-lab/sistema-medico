# Cotejo de los algoritmos clínicos contra las guías internacionales

**Fecha del cotejo:** 24-sep-2026 · **Hecho por:** agente de ingeniería (Claude Opus 5) · **Estado:** PREPARATORIO

## Qué es y qué NO es este documento

Es un cotejo **de ingeniería**: para cada algoritmo implementado se compara lo que el código hace de verdad —fórmula, cotas,
umbrales y bandas, leídos del propio código, no de su documentación— contra el texto de la guía o el artículo primario que
dice seguir. El resultado es un veredicto por algoritmo y, donde hay divergencia, la **decisión concreta** que hace falta.

**NO es una validación clínica y no la sustituye.** Un cotejo bibliográfico no evalúa si el algoritmo es apropiado para la
población de este consultorio, ni si su uso en el flujo de trabajo real induce a error, ni acepta el riesgo residual. Eso lo
firma un especialista, y sigue siendo una condición de dueño en
[ADR-0300](../adr/ADR-0300-condiciones-de-admision-a-produccion.md).

**Límites de quien lo hizo, dichos por delante:**

- El cotejo se hace contra el contenido de las guías tal como lo conoce el agente, con **corte de conocimiento en mayo de
  2026**. Las guías se revisan: cada fila marcada «verificar vigencia» necesita que alguien abra el texto actual y confirme
  que no hay una versión posterior.
- Donde dos sociedades vigentes **discrepan entre sí** (pasa en dos de los diez algoritmos), el cotejo no elige: expone la
  discrepancia y pide la decisión. Elegir guía es una decisión clínica e institucional, no técnica.
- Ningún número de este documento se ha escrito en el código a partir de este cotejo. Lo que el cotejo produce son
  **decisiones pendientes**, no cambios.

## Resumen

| # | Algoritmo | Veredicto | Decisión pendiente |
| --- | --- | --- | --- |
| 1 | CKD-EPI 2021 (eGFR adulto) | **Coincide** con la fuente | Estadificar ERC por **G + albuminuria** (KDIGO), hoy solo G |
| 2 | Schwartz de cabecera 2009 (eGFR pediátrico) | **Coincide** | Existe sucesor (CKiD U25, 2021): ¿se adopta? |
| 3 | Gradiente alvéolo-arterial | **Coincide** | Ninguna |
| 4 | Interpretación ácido-base | **Coincide** | Corregir la brecha aniónica por **albúmina** (misma fuente ya citada) |
| 5 | CURB-65 | **Coincide** con el artículo | **La guía de neumonía prefiere otro índice (PSI/PORT)** |
| 6 | CHA₂DS₂-VASc | **Rezago frente a la guía europea 2024** | **Elegir guía: ESC 2024 (CHA₂DS₂-VA) o ACC/AHA 2023 (VASc)** |
| 7 | FIB-4 | **Coincide, con el ajuste por edad** | Nomenclatura MASLD (2023) en los textos |
| 8 | Índice de Charlson | **Coincide** con la versión declarada | ¿Pesos originales (1987) o actualizados (2011)? |
| 9 | NEWS2 | **Coincide** | Confirmar que aplica a la población del consultorio |
| 10 | MELD / MELD-Na | **Coincide y declara su propio rezago** | ¿Implementar MELD 3.0 (2023)? |

Además, fuera de los diez: **metas de cuidado**, **estadificación de presión arterial** y **valores de pánico de
laboratorio** llevan contenido clínico y tienen sus propias decisiones (al final).

---

## 1. `CKD-EPI-2021` — filtración glomerular estimada (adulto)

**Lo que hace el código** (`packages/renal-function`): `eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^(−1.200) × 0.9938^edad ×
(1.012 si mujer)`, con κ = 0.7/0.9 y α = −0.241/−0.302. **Sin coeficiente de raza.** Cotas de plausibilidad y negativa a
calcular fuera de ellas. En pediatría no calcula: reporta *no computable* y remite a Schwartz.

**Guía de referencia:** Inker LA et al., *NEJM* 2021;385:1737-49 (grupo de trabajo NKF-ASN). La eliminación del coeficiente
de raza es decisión de la propia fuente, no del implementador.

**Veredicto: COINCIDE.** Fórmula, coeficientes y ausencia de raza son los de la fuente.

**Brechas frente a la guía de práctica (KDIGO), no frente a la ecuación:**

1. **La ERC se estadifica por C-G-A: causa, filtración y albuminuria.** El sistema estadifica solo por **G**. Tiene los
   cortes de albuminuria de KDIGO en el catálogo de laboratorio (UACR: A1 < 30, A2 30–300, A3 > 300 mg/g) pero **no los
   combina** con el eGFR. Consecuencia clínica concreta: un paciente con eGFR 95 y UACR 400 mg/g **tiene ERC de riesgo
   alto** y el sistema lo presentaría como función renal normal. Es la brecha con más consecuencia de todo este cotejo.
2. **Confirmación con cistatina C** cuando la creatinina es poco fiable (masa muscular extrema, amputados, cirrosis) o
   cuando la decisión exige precisión. No implementado; el módulo ya advierte de los extremos de masa muscular.
3. **Predicción de riesgo (KFRE)** para decidir referencia a nefrología. No implementado.

**Decisión pendiente:** ¿se implementa la estadificación C-G-A con el mapa de riesgo de KDIGO? *(Recomendación del agente:
sí, es la brecha de mayor consecuencia y no exige inventar ningún número: los cortes ya están en el repositorio.)*

*Verificar vigencia: KDIGO publicó una actualización de la guía de ERC en 2024; conviene confirmar el texto vigente.*

---

## 2. `SCHWARTZ-BEDSIDE-2009` — filtración glomerular estimada (pediátrica)

**Lo que hace el código:** `eGFR = 0.413 × talla(cm) / creatinina(mg/dL)`, solo entre 1 y 17 años, **exigiendo la talla**
(sin talla no calcula) y **sin estadificar ERC** (la cronicidad y la estadificación pediátrica no se asumen).

**Guía de referencia:** Schwartz GJ et al., *JASN* 2009;20:629-37 (cohorte CKiD).

**Veredicto: COINCIDE**, incluidas las dos decisiones correctas que suelen faltar: no suponer la talla y no estadificar.

**Nota de vigencia:** existe un sucesor, las ecuaciones **CKiD U25** (Pierce CB et al., *Kidney Int* 2021), específicas por
edad y sexo y válidas hasta los 25 años. La ecuación de cabecera sigue siendo la de uso masivo en la práctica.

**Decisión pendiente:** ¿se adopta U25, se mantiene la de cabecera, o se implementan ambas declarando cuál se usa?

---

## 3. `AA-GRADIENT` — gradiente alvéolo-arterial de oxígeno

**Lo que hace el código** (`packages/oxygenation`): `PAO₂ = FiO₂·(Patm − PH₂O) − PaCO₂/0.8`, con Patm y PH₂O declarados y
cotas de altitud; gradiente esperado por edad `2.5 + 0.21 × edad`, y —lo importante— **marca el esperado como no válido con
oxígeno suplementario**, porque la fórmula del esperado solo vale respirando aire ambiente; en ese caso remite a PaO₂/FiO₂.

**Guía de referencia:** Mellemgaard K, *Acta Physiol Scand* 1966 (gradiente esperado por edad); atmósfera estándar ISO 2533.

**Veredicto: COINCIDE.** Sin brecha material. El manejo del oxígeno suplementario es más cuidadoso que el habitual.

**Decisión pendiente:** ninguna.

---

## 4. `ACID-BASE` — interpretación ácido-base

**Lo que hace el código** (`packages/acid-base`): clasifica el trastorno primario, calcula la **compensación esperada de los
cuatro trastornos** (no solo Winters), exige el **tipo de muestra** y no juzga compensación en sangre venosa, calcula la
**brecha aniónica**, bifurca la acidosis metabólica y calcula el **delta-delta** para descubrir trastornos mixtos.

**Guías de referencia:** Winters (Albert, Dell & Winters, *Ann Intern Med* 1967); reglas de compensación de Narins & Emmett,
*Medicine* 1980; enfoque fisiológico y delta-delta de Berend K et al., *NEJM* 2014.

**Veredicto: COINCIDE**, y con más profundidad que la mayoría de las implementaciones (los cuatro trastornos, el delta-delta
y la exigencia de muestra arterial).

**Brecha concreta:** la **brecha aniónica no se corrige por albúmina**. Con hipoalbuminemia —frecuente en el paciente
crítico, el cirrótico y el nefrótico— la brecha aniónica «normal» **enmascara una acidosis de brecha alta**. La corrección
estándar es `AG corregido = AG + 2.5 × (4.0 − albúmina g/dL)`, y está en la misma fuente que el código ya cita (Berend 2014).
El albúmina está en el catálogo de laboratorio del propio repositorio.

**Decisión pendiente:** ¿se implementa la corrección por albúmina? *(Recomendación del agente: sí; el número no se inventa,
sale de la fuente ya citada, y la consecuencia de no hacerlo es una acidosis no detectada.)*

---

## 5. `CURB-65` — gravedad de neumonía adquirida en la comunidad

**Lo que hace el código** (`packages/pneumonia-severity`): un punto por Confusión (nueva, **declarada**, no asumida),
BUN > 19 mg/dL, FR ≥ 30, PA sistólica < 90 o diastólica ≤ 60, edad ≥ 65. Edad mínima 16 años declarada. Mortalidad a 30 días
por puntaje según la fuente.

**Guía de referencia:** Lim WS et al., *Thorax* 2003;58:377-82.

**Veredicto: COINCIDE frente al artículo** (criterios, cortes y mortalidad a 30 días), **con divergencia frente a la guía de práctica** (ver abajo).

**Divergencia frente a la guía de práctica:** la guía de neumonía adquirida en la comunidad de **ATS/IDSA (2019)**
recomienda usar el **PSI/PORT** —no CURB-65— para decidir el sitio de atención, por mayor evidencia de validación. CURB-65
sigue siendo útil como cribado rápido, pero la guía expresa una preferencia.

**Decisión pendiente:** ¿se implementa PSI/PORT, o se declara CURB-65 como **cribado** y no como criterio de ingreso?
*(Recomendación del agente: declararlo como cribado es honesto y barato; implementar PSI exige 20 variables y no se puede
hacer a medias.)*

---

## 6. `CHA2DS2-VASC` (CHA₂DS₂-VASc) — riesgo tromboembólico en fibrilación auricular

**Lo que hace el código** (`packages/stroke-risk`): componentes clásicos (ICC, hipertensión, edad ≥ 75 = 2 / ≥ 65 = 1,
diabetes, ictus previo = 2, enfermedad vascular, **sexo femenino = 1**), con **umbrales específicos por sexo** (en mujeres el
punto por sexo no cuenta para la decisión) y **sin cifra de riesgo anual** —se retiró porque la tabla del artículo no es
monótona y presentarla daba una precisión falsa—. Declara además que **no evalúa riesgo de sangrado**.

**Guía de referencia implementada:** Lip GYH et al., *Chest* 2010, en la línea de la guía **ACC/AHA/ACCP/HRS 2023** de
fibrilación auricular, que mantiene CHA₂DS₂-VASc.

**Veredicto: REZAGO / DIVERGENCIA MAYOR.** La guía de **fibrilación auricular de la ESC (2024)** sustituyó el índice por
**CHA₂DS₂-VA**, que **elimina el punto por sexo**, precisamente para no sostener umbrales distintos según el sexo, y
recomienda anticoagulación con CHA₂DS₂-VA ≥ 2 (y considerarla con 1). Es decir: **dos guías vigentes discrepan**, y el
sistema implementa la vertiente americana.

Consecuencia concreta de la elección: con la versión europea, una mujer de 68 años con hipertensión puntúa 2 y se
anticoagula; con la americana puntúa 3 pero, descontando el punto por sexo, la decisión queda en el mismo sitio. La
diferencia práctica aparece en los casos de puntaje 1–2, que es donde vive la duda.

**Decisión pendiente (la más importante de este cotejo):** ¿qué guía sigue el sistema, ESC 2024 o ACC/AHA 2023? La elección
debe quedar escrita, porque el algoritmo cambia de nombre y de umbral.

*Verificar vigencia: ambas guías son recientes; confirmar si hay actualización posterior a mayo de 2026.*

---

## 7. `FIB-4` — índice de fibrosis hepática

**Lo que hace el código** (`packages/liver-fibrosis`): `FIB-4 = edad × AST / (plaquetas(10⁹/L) × √ALT)`, con corte bajo
**1.3**, corte alto **2.67** y —esto suele faltar— **corte bajo ajustado a 2.0 en ≥ 65 años**, con su fuente anotada
(McPherson 2017), porque a esa edad el 1.3 pierde especificidad y genera derivaciones innecesarias.

**Guías de referencia:** Sterling RK et al., *Hepatology* 2006 (cortes originales); ruta de cribado de AASLD/AGA para
enfermedad hepática esteatósica, que usa el mismo escalonado (< 1.3 riesgo bajo → 1.3–2.67 indeterminado → elastografía o
ELF → > 2.67 riesgo alto).

**Veredicto: COINCIDE**, y el ajuste por edad lo pone por encima de la implementación típica.

**Nota terminológica:** desde 2023 la nomenclatura cambió de NAFLD/NASH a **MASLD/MASH** (y MetALD para el consumo de alcohol
concomitante). Conviene que los textos que el médico lee usen la nomenclatura vigente.

**Decisión pendiente:** actualizar la nomenclatura en los textos de pantalla (no afecta al cálculo).

---

## 8. `CHARLSON` — índice de comorbilidad de Charlson

**Lo que hace el código** (`packages/comorbidity`): las **17 categorías** del índice original con los **pesos de 1987**
(1/2/3/6), el **mapeo a CIE-10 de Quan 2005** y las **jerarquías** del índice (la forma grave desplaza a la leve).

**Guías de referencia:** Charlson ME et al., *J Chronic Dis* 1987; mapeo de Quan H et al., *Med Care* 2005.

**Veredicto: COINCIDE** con la versión que declara implementar.

**Alternativa vigente:** Quan et al. publicaron en 2011 **pesos actualizados** (12 condiciones, pesos recalibrados) que
ajustan mejor en poblaciones contemporáneas. El código eligió los pesos originales **a propósito y por escrito**, porque la
fórmula de supervivencia estimada que usa se validó con esos pesos. Es una decisión declarada, no un descuido.

**Decisión pendiente:** confirmar la elección (originales 1987) o pasar a los actualizados 2011 **con** la fórmula de
supervivencia que les corresponda. Mezclar pesos nuevos con la fórmula vieja sería peor que cualquiera de las dos opciones.

---

## 9. `NEWS2-RCP-2017` — escala de alerta temprana

**Lo que hace el código** (`packages/lab-reference`): NEWS2 completo con **escala 1 y escala 2 de SpO₂** (la 2 para
insuficiencia respiratoria hipercápnica con objetivo 88–92 %, y es **decisión del médico**, no se asume), **oxígeno
suplementario explícito** y **sin puntuación parcial**: si faltan parámetros no se calcula una banda con lo que haya, porque
los datos ausentes bajarían el riesgo.

**Guía de referencia:** Royal College of Physicians, *National Early Warning Score (NEWS) 2*, 2017.

**Veredicto: COINCIDE**, incluidas las tres decisiones que más se incumplen en las implementaciones (escala 2, oxígeno
suplementario y negativa a puntuar de forma parcial).

**Consideraciones de aplicabilidad, para el especialista:** NEWS2 es un estándar del sistema de salud británico, no una norma
mexicana, y su rendimiento se ha discutido en poblaciones concretas (urgencias, COVID-19). Su uso aquí es como **alerta**,
no como criterio de ingreso.

**Decisión pendiente:** confirmar que NEWS2 es la escala de alerta que quiere el consultorio, y en qué población.

---

## 10. `MELD` / MELD-Na — gravedad en hepatopatía avanzada

**Lo que hace el código** (`packages/meld`): MELD clásico (2001) con creatinina acotada a [1, 4], **creatinina fijada en 4.0
si hay diálisis** (y advirtiendo que sin ese dato el puntaje subestima), tramos de mortalidad a 3 meses de Wiesner 2003, y
MELD-Na (2016) con el sodio acotado a 125–137 y aplicado **solo si MELD > 11**.

**Guías de referencia:** Kamath PS et al., *Hepatology* 2001; Wiesner RH et al., *Gastroenterology* 2003; Kim WR et al.,
*NEJM* 2008 (corrección por sodio, adoptada por UNOS/OPTN en 2016).

**Veredicto: COINCIDE con lo que implementa, y —esto es lo importante— DECLARA SU PROPIO REZAGO.** El módulo lleva una
advertencia permanente de que la **asignación de órganos usa MELD 3.0 desde 2023** (Kim WR et al., *Gastroenterology* 2021),
que añade albúmina y sexo y recalibra la creatinina, y que **este sistema no lo implementa**. Eso es exactamente lo que debe
hacer un sistema que va por detrás de la guía: decirlo donde se lee el resultado.

**Decisión pendiente:** ¿se implementa MELD 3.0? Solo es imprescindible si el sistema se va a usar cerca de una decisión de
trasplante. Si no, la advertencia actual es suficiente.

---

## Contenido clínico fuera de los diez algoritmos

### Metas de cuidado (`packages/care-goals`)

| Meta | Fuente declarada | Veredicto |
| --- | --- | --- |
| HbA1c < 7 % | ADA, *Standards of Care* | **Coincide.** Población e individualización declaradas (anciano frágil, hipoglucemia previa, embarazo). |
| Glucosa en ayuno 80–130 mg/dL (con diabetes) | ADA | **Coincide.** Y declara que < 100 es umbral de normalidad, no meta de tratamiento. |
| Presión arterial < 130/80 | ACC/AHA 2017 | **Coincide con la guía americana.** La guía europea (ESC 2024) es más estricta para buena parte de los pacientes. **Decisión de guía.** |
| IMC 18.5–24.9 | OMS | **Coincide**, con los límites declarados (menores de 18, embarazo, sarcopenia, deportistas, adulto mayor). |
| LDL | Sin meta universal, por categoría de riesgo | **Correcto.** Si quieres que el sistema muestre las categorías, ESC/EAS 2019 las fija (< 55 / < 70 / < 100 / < 116 mg/dL según riesgo) y ACC/AHA 2018 usa un enfoque por riesgo. **Decisión: declararlas o seguir sin meta.** |

### Estadificación de presión arterial (`packages/bp-staging`)

ACC/AHA 2017 (normal, elevada, estadio 1, estadio 2, crisis > 180/120), más hipotensión e hipotensión severa —que la guía no
estadifica y el sistema añadió con su razón escrita—. **Coincide con la guía americana**; ESC 2024 usa categorías distintas.
**Misma decisión de guía que la meta de presión arterial: las dos deben elegir lo mismo.**

### Valores de pánico de laboratorio (`packages/lab-reference`)

28 analitos con rango normal y umbrales críticos, estratificados por sexo y edad. El propio módulo declara que son **«umbrales
de adulto de demostración»** y que los oficiales se parametrizarían de la fuente autorizada.

**Esto no es una brecha de guía: es una brecha institucional.** Los valores de pánico **los define cada laboratorio** según su
método analítico y su población, y se acuerdan con el cuerpo clínico. Ninguna guía internacional los fija de forma universal.

**Decisión pendiente:** conseguir la tabla de valores críticos del laboratorio con el que trabaja el consultorio y
parametrizarla. Es la decisión con más alcance de todas las de esta página: esos umbrales disparan el lazo de resultado
crítico, bloquean la firma del encuentro y abren obligaciones urgentes.

---

## Decisiones para firmar

| # | Decisión | Prioridad del agente |
| --- | --- | --- |
| D1 | Guía de fibrilación auricular: **ESC 2024 (CHA₂DS₂-VA)** o **ACC/AHA 2023 (CHA₂DS₂-VASc)** | **Alta** — cambia nombre y umbral |
| D2 | Estadificar ERC por **G + albuminuria** (KDIGO C-G-A) | **Alta** — hoy un eGFR normal con albuminuria grave se presenta como normal |
| D3 | Corregir la **brecha aniónica por albúmina** | **Alta** — hoy una acidosis de brecha alta puede pasar desapercibida |
| D4 | **Valores de pánico** del laboratorio real | **Alta** — gobiernan el lazo de resultado crítico |
| D5 | Guía de presión arterial (ACC/AHA vs ESC), para meta **y** estadificación | Media |
| D6 | CURB-65 como **cribado** o implementar **PSI/PORT** | Media |
| D7 | Pesos de Charlson: 1987 (actual) o 2011 con su fórmula | Baja |
| D8 | eGFR pediátrico: mantener Schwartz de cabecera o adoptar **CKiD U25** | Baja |
| D9 | Implementar **MELD 3.0** | Baja, salvo uso cercano a trasplante |
| D10 | Nomenclatura **MASLD/MASH** en los textos | Baja |

## Cómo se mantiene honesto este documento

`tests/v22/guideline-crosscheck.test.ts` exige que **cada algoritmo declarado en
`packages/clinical-algorithm-specs` tenga su sección aquí**, con su fuente y su veredicto. Añadir un algoritmo sin cotejarlo
rompe la compilación. El test no puede comprobar que el cotejo sea *correcto* —eso es trabajo de quien lo lea— pero sí que
exista y que no se quede atrás.
