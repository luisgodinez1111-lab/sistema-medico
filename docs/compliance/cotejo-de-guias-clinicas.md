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
| 1 | CKD-EPI 2021 (eGFR adulto) | **Coincide**; **C-G-A APLICADO (D2, 25-sep-2026)** | Cistatina C y KFRE siguen sin implementar |
| 2 | Schwartz de cabecera 2009 (eGFR pediátrico) | **Coincide** | Existe sucesor (CKiD U25, 2021): ¿se adopta? |
| 3 | Gradiente alvéolo-arterial | **Coincide** | Ninguna |
| 4 | Interpretación ácido-base | **Coincide**; la corrección por albúmina **YA ESTABA** (error de este cotejo, corregido) | Ninguna |
| 5 | CURB-65 | **Coincide** con el artículo | **La guía de neumonía prefiere otro índice (PSI/PORT)** |
| 6 | CHA₂DS₂-VA | **APLICADO (D1, 25-sep-2026): se adoptó ESC 2024** | Ninguna. Alternativa ACC/AHA 2023 declarada y no implementada |
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

**DECISIÓN D2 APLICADA el 25-sep-2026.** Se implementó la estadificación C-G-A con el mapa de riesgo de KDIGO, sin inventar
ningún número: las categorías de albuminuria salen de los cortes que ya estaban en el repositorio y la matriz de riesgo es la
tabla publicada por la guía, transcrita entera (`cgaStage` en `packages/renal-function`, cableada en el endpoint de eGFR).
Tres cosas que la implementación hace y conviene saber:

- **Sin albuminuria no se afirma riesgo:** se devuelve «estadio C-G-A incompleto» y se pide el cociente albúmina/creatinina.
  Estadificar por filtración sola y llamarlo riesgo era el defecto; devolver un riesgo a medias lo habría conservado.
- **El caso del hallazgo queda fijado por prueba:** eGFR 95 con UACR 400 mg/g ya no es «G1 — normal o alto», es **G1A3, riesgo
  alto**, con la conducta que corresponde (vigilancia y valorar referencia a nefrología).
- **Se eliminó una segunda fuente:** el endpoint repetía los cortes de albuminuria por su cuenta y discrepaba en el límite
  exacto de 300 mg/g (lo dejaba en A3 cuando KDIGO lo incluye en A2). Ahora hay una sola.

**Siguen sin implementar** (y sin fingir que lo están): confirmación con cistatina C y predicción de riesgo KFRE.

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

**CORRECCIÓN DE ESTE COTEJO (25-sep-2026).** La primera versión de este documento afirmó que la brecha aniónica **no** se
corregía por albúmina. **Era un error mío y la decisión D3 no hacía falta:** la corrección `AG + 2.5 × (4.0 − albúmina)` ya
estaba implementada en `packages/lab-derivations`, el endpoint de ácido-base le pasa la albúmina del paciente, y el módulo
declara expresamente cuándo NO pudo corregir («sin corregir por albúmina: una hipoalbuminemia la subestima»). Leí
`packages/acid-base` —que recibe la brecha ya calculada— y no seguí el hilo hasta donde se calcula.

Queda una prueba que fija la corrección para que no se pierda, y la lección para el resto del cotejo: **un módulo que recibe
un valor no es el sitio donde se decide ese valor.**

**Decisión pendiente:** ninguna.

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

## 6. `CHA2DS2-VA-ESC-2024` (CHA₂DS₂-VA) — riesgo tromboembólico en fibrilación auricular

**Guía de referencia implementada:** 2024 ESC Guidelines for the management of atrial fibrillation (*European Heart Journal*
2024).

**Veredicto: COINCIDE con la guía elegida.** Antes del 25-sep-2026 el veredicto era «rezago frente a la guía europea 2024»;
la decisión D1 lo resolvió adoptándola.

**DECISIÓN D1 APLICADA el 25-sep-2026: se adoptó la ESC 2024.** El dueño instruyó elegir «la más reciente y con más peso de
validez»; la guía de fibrilación auricular de la ESC (2024) es la más reciente de las dos y sustenta el cambio con
re-análisis de discriminación del componente de sexo.

**Lo que hace el código ahora** (`packages/stroke-risk`): los siete componentes de CHA₂DS₂-VA —ICC 1, hipertensión 1, edad
≥ 75 = 2 / 65–74 = 1, diabetes 1, ictus/TIA previo 2, enfermedad vascular 1—, **sin punto por sexo** y con **umbrales
iguales para ambos sexos**: ≥ 2 anticoagulación recomendada, = 1 considerarla, 0 sin antitrombótico. El sexo se informa como
**modificador** (con puntaje 1 el riesgo absoluto de la mujer es mayor y pesa a favor de anticoagular), no como punto. Se
conserva lo que ya era correcto: sin cifra de riesgo anual inventada y con la declaración de que el **riesgo hemorrágico no
se ha evaluado**.

**Qué cambió en la práctica:** el puntaje de una mujer baja en uno y su umbral también, así que la conducta no cambia para la
mayoría. Cambia donde vive la duda —puntajes 1 y 2— y, sobre todo, **desaparece el umbral que dependía del sexo**, que es la
razón del cambio en la guía.

**Alternativa declarada y no implementada:** ACC/AHA/ACCP/HRS 2023 (CHA₂DS₂-VASc, Lip GYH et al., *Chest* 2010). Queda
escrita en el módulo y en la especificación del algoritmo, para que nadie tenga que adivinar qué guía sigue el sistema.

**Rastro del cambio:** el identificador del algoritmo pasó a `CHA2DS2-VA-ESC-2024` y la versión del recibo de cálculo a 4,
así que los cálculos anteriores y los nuevos son distinguibles en la auditoría.

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

## 11. `CLASSIFY-LAB` — clasificación de un resultado de laboratorio

**Qué hace.** Elige la fila de referencia del estrato del paciente (edad, sexo, embarazo, ayuno) y compara el valor —convertido
a la unidad canónica— contra cuatro cortes. Los bordes son **inclusivos**: un potasio en el corte crítico exacto ya es crítico.

| Aspecto | Fuente declarada | Veredicto |
| --- | --- | --- |
| Rangos por analito | **Una fuente por analito y por estrato** (WHO 2011, Tietz, Nathan & Oski para neonato, ADA 2024 para glucosa, EASL 2016 para transaminasas) | **Coincide.** Los 30 analitos tienen fuente; ninguno queda con un umbral «de demostración». Verificado por prueba automática. |
| Borde crítico inclusivo | Decisión de este sistema | **Correcto y es lo que un médico espera:** un valor en el corte no es «casi» crítico. |
| Valor no interpretable | — | **Devuelve UNKNOWN, no NORMAL.** Es la propiedad que más importa de un clasificador. |

**Lo que falta y es del médico (R09-020, R09-025):** confirmar que los rangos elegidos son los apropiados para la población
atendida y para el laboratorio que procesa las muestras. Un rango de referencia es **del método analítico**, no universal:
dos laboratorios pueden reportar rangos distintos para el mismo analito y los dos tener razón.


**Guía de referencia:** una **por analito y por estrato**, declarada en cada fila de `packages/lab-reference`: WHO, *Haemoglobin
concentrations for the diagnosis of anaemia* (2011); Tietz *Clinical Guide to Laboratory Tests*; Nathan & Oski, *Hematology of
Infancy and Childhood* (neonato); ADA, *Standards of Care in Diabetes* 2024 (glucosa); EASL (2016, transaminasas).

**Veredicto: COINCIDE con las fuentes citadas.** Los 30 analitos tienen fuente —verificado por prueba automática— y ninguno
conserva un umbral «de demostración». El borde crítico inclusivo y el `UNKNOWN` ante un valor no interpretable son correctos.

**Decisión pendiente (del médico, R09-020/R09-025):** confirmar que estos rangos son los del laboratorio que procesa las
muestras. Un rango de referencia es **del método analítico**, no universal: dos laboratorios pueden reportar rangos distintos
para el mismo analito y los dos tener razón.

---

## 12. `DELTA-CHECK` — cambio agudo entre dos resultados

**Qué hace.** Compara el resultado nuevo con el previo por diferencia absoluta y por razón, cada criterio dentro de **su**
ventana. Fuera de ventana NO evalúa y lo dice.

| Regla | Fuente declarada | Veredicto |
| --- | --- | --- |
| Creatinina: ≥0,3 mg/dL en 48 h, o ≥1,5× en 7 días | **KDIGO 2012 §2.1** | **Coincide con la definición de lesión renal aguda.** Hasta el 07-oct-2026 el sistema usaba 0,5 mg/dL y ×2 **sin fuente** —el estadio 2 aproximado—, así que **no detectaba el estadio 1**, que es donde intervenir cambia el desenlace. Corregido. **Aumenta la sensibilidad: marcará resultados que antes pasaban.** |
| Plaquetas: caída ≥50 % | Score **4T** para trombocitopenia inducida por heparina (Lo, Juhl & Warkentin, 2006) | **Coincide** con el criterio de recuento del score. |
| Sodio: cambio ≥10 mEq/L | Límite de velocidad de corrección de la hiponatremia (guía europea, Spasovski et al., 2014) | **Coincide en magnitud.** El riesgo está en la VELOCIDAD, de ahí que se aplique en cualquier dirección. |
| Hemoglobina ≥2 g/dL; potasio ≥1 mEq/L; calcio ≥2 mg/dL; glucosa ≥200 mg/dL | **Criterios OPERATIVOS de este sistema** | **No hay corte publicado** para estos deltas y el código lo declara con esas palabras en lugar de atribuirles una guía. **Decisión del médico:** confirmarlos o cambiarlos. |

**Defecto encontrado por los vectores golden, y es la razón de tenerlos:** la comparación se hacía sobre la resta en coma
flotante, así que `1,2 − 0,9` daba 0,29999999999999993 y **no** alcanzaba el umbral de 0,3, mientras `1,3 − 1,0` daba
0,30000000000000004 y sí. El mismo delta clínico, dos veredictos. Ahora la magnitud se redondea a la precisión con que el
laboratorio reporta el analito antes de comparar.


**Guía de referencia:** KDIGO 2012, *Clinical Practice Guideline for Acute Kidney Injury* §2.1 (creatinina); score 4T
(Lo, Juhl & Warkentin, *J Thromb Haemost* 2006, plaquetas); Spasovski et al., guía europea de hiponatremia (2014, sodio). Para
hemoglobina, potasio, calcio y glucosa **no existe corte publicado** y el código los declara como criterios operativos.

**Veredicto: COINCIDE tras la corrección del 07-oct-2026.** Antes **no coincidía**: el umbral de creatinina (0,5 mg/dL y ×2,
sin fuente) correspondía aproximadamente al estadio 2 de KDIGO, así que el sistema **no detectaba el estadio 1** —≥0,3 mg/dL en
48 h o ≥1,5× en 7 días—, que es donde intervenir cambia el desenlace.

**Decisión pendiente (del médico):** confirmar los cuatro criterios operativos (hemoglobina, potasio, calcio, glucosa), y
aceptar que la corrección de creatinina **aumenta la sensibilidad**: marcará resultados que antes pasaban en silencio.

---

## 13. `CLASSIFY-VITAL` — clasificación de un signo vital por edad

| Aspecto | Fuente declarada | Veredicto |
| --- | --- | --- |
| Franjas pediátricas | AHA, *2020 Guidelines for CPR and ECC*, sección pediátrica (PALS) — **orientativa** | **Aceptable como orientación.** PALS publica rangos por edad, no cortes de alarma normativos. |
| Franjas adultas | **Sin guía única.** Valores de alarma de uso corriente en monitorización | **Es la mitad de este algoritmo que más necesita validación médica.** El código lo declara en vez de atribuirles una fuente. |
| PESO y TALLA | — | **No se clasifican, a propósito.** Un peso «normal» exige percentiles por edad y sexo en pediatría y criterio de IMC en adulto; fabricar un rango único sería peor que declarar que no se clasifica. |


**Guía de referencia:** AHA, *2020 Guidelines for CPR and Emergency Cardiovascular Care*, sección pediátrica (PALS), como
referencia **orientativa** de rangos por edad. Para las franjas **adultas no hay guía única** y el código lo declara.

**Veredicto: PARCIAL.** Las franjas pediátricas son razonables como orientación; las adultas son valores de alarma de uso
corriente **sin fuente normativa**, y ésa es la mitad de este algoritmo que más necesita validación médica. PESO y TALLA no se
clasifican a propósito, lo cual es correcto: fabricar un rango único sería peor que declarar que no se clasifica.

**Decisión pendiente (del médico, R09-020/R09-025):** fijar y firmar las franjas adultas, o aceptarlas como orientativas con
esa etiqueta visible al clínico.

---

## 14. `TREND-GOALS` — metas de los gráficos de tendencia

Cotejado en detalle en la sección «Metas de cuidado» de más abajo, que es el mismo conjunto (`packages/care-goals`). Lo que
esta ficha añade es la regla de presentación: **donde no hay meta universal (LDL, creatinina) la pantalla no pinta ninguna
franja**, porque una franja verde es la afirmación más fuerte que puede hacer un gráfico y sobre LDL sería falsa para buena
parte de los pacientes.


**Guía de referencia:** ADA, *Standards of Care in Diabetes* (HbA1c y glucosa preprandial); ACC/AHA 2017 (presión
arterial); OMS (IMC). Para **LDL no existe meta universal** —ACC/AHA y ESC/EAS estratifican por categoría de riesgo— y para
creatinina no hay meta: es una tendencia.

**Veredicto: COINCIDE.** Cada meta viaja con su fuente y con el aviso de que la del paciente la fija su médico. Y la regla de
presentación es la correcta: donde no hay meta universal **la pantalla no pinta ninguna franja**, porque una franja verde es la
afirmación más fuerte que puede hacer un gráfico y sobre LDL sería falsa para buena parte de los pacientes.

**Decisión pendiente:** ninguna en ingeniería. La individualización por paciente (anciano frágil, embarazo, pediatría) es
clínica y el sistema la declara en vez de simularla.

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

**Decisión pendiente (encauzada el 25-sep-2026):** conseguir la tabla del laboratorio y parametrizarla. El documento
[`valores-de-referencia-mexico.md`](valores-de-referencia-mexico.md) explica por qué ninguna guía internacional ni ninguna NOM
puede dar esos valores —la **NOM-007-SSA3-2011** obliga a cada laboratorio a establecer y documentar los suyos—, deja el
formato exacto que hay que pedirle, la lista de los 28 analitos y lo que hago yo cuando llegue. Mientras no llegue, el sistema
seguirá declarando que sus umbrales son de demostración. Es la decisión con más alcance de todas las de esta página: esos umbrales disparan el lazo de resultado
crítico, bloquean la firma del encuentro y abren obligaciones urgentes.

---

## Decisiones para firmar

| # | Decisión | Prioridad del agente |
| --- | --- | --- |
| D1 | ~~Guía de fibrilación auricular~~ | **APLICADA (25-sep-2026): ESC 2024, CHA₂DS₂-VA** |
| D2 | ~~Estadificar ERC por G + albuminuria~~ | **APLICADA (25-sep-2026): `cgaStage` con la tabla de KDIGO** |
| D3 | ~~Corregir la brecha aniónica por albúmina~~ | **NO PROCEDÍA: ya estaba implementada.** Error de este cotejo, corregido en §4 |
| D4 | **Valores de pánico** del laboratorio real | **Alta** — encauzada el 25-sep-2026: el marco normativo, el formato exacto que hay que pedir al laboratorio y por qué ninguna guía puede darlo están en [`valores-de-referencia-mexico.md`](valores-de-referencia-mexico.md). Falta la tabla firmada del laboratorio |
| D5 | Guía de presión arterial (ACC/AHA vs ESC), para meta **y** estadificación | **Media** |
| D6 | CURB-65 como **cribado** o implementar **PSI/PORT** | **Media** |
| D7 | Pesos de Charlson: 1987 (actual) o 2011 con su fórmula | **Baja** |
| D8 | eGFR pediátrico: mantener Schwartz de cabecera o adoptar **CKiD U25** | **Baja** |
| D9 | Implementar **MELD 3.0** | Baja, salvo uso cercano a trasplante |
| D10 | Nomenclatura **MASLD/MASH** en los textos | **Baja** |

## Cómo se mantiene honesto este documento

`tests/v22/guideline-crosscheck.test.ts` exige que **cada algoritmo declarado en
`packages/clinical-algorithm-specs` tenga su sección aquí**, con su fuente y su veredicto. Añadir un algoritmo sin cotejarlo
rompe la compilación. El test no puede comprobar que el cotejo sea *correcto* —eso es trabajo de quien lo lea— pero sí que
exista y que no se quede atrás.
