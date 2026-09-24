# Uso previsto por endpoint de cálculo clínico

**Origen.** Auditoría del repositorio, 19-sep-2026, anexo R03, hallazgo **R03-35** (CRÍTICA):

> «21 endpoints interpretan datos del paciente y emiten recomendaciones clínicas, y el repositorio se declara “fuera del
> alcance de dispositivo médico” sin una declaración de uso previsto por función.»

La auditoría verificó que el registro de aplicabilidad NOM (`nom-applicability-register.json`) se autoexcluía calificando
el producto como «software de gestión clínica», y que **el propio código lo contradice**: estos endpoints interpretan
datos del paciente y proponen conducta terapéutica, y la prescripción se bloquea con `SAFETY_BLOCKED`. Eso no es gestión
clínica: es apoyo a la decisión clínica.

**Qué se hizo y qué no.** La autoexclusión se retiró del registro y se sustituyó por «pendiente de determinación» con la
lista de módulos candidatos (este documento). **La determinación formal de alcance, intended-use y clasificación de
riesgo es de Regulatory: es decisión del dueño del producto (G-04), no de ingeniería.** Lo que sí es responsabilidad del
código, y ya está hecho, es no presentar un cálculo como si fuera un veredicto: cada respuesta declara el algoritmo, su
versión, la autoridad clínica de la que salen sus umbrales, el hash de las entradas con las que se calculó (`receipt`) y
la advertencia de uso (`usageWarning`).

**Advertencia que acompaña a todas estas respuestas** (`CLINICAL_USE_WARNING`, `apps/web/lib/calc-receipt.ts`):

> Apoyo a la decisión clínica: el resultado se calcula con los datos registrados en el expediente y NO sustituye el
> juicio del médico tratante, que es quien decide. Verifique las entradas (valores, unidades y fechas) antes de actuar.

---

## Tabla de uso previsto

Para cada endpoint: qué recibe, qué devuelve, en qué población es válido, **quién decide** y **qué NO hace**.
Todo el contenido clínico está **pendiente de validación por un médico** antes de uso asistencial.

| Endpoint | Entrada | Salida | Población validada | Quién decide | Qué NO hace |
|---|---|---|---|---|---|
| `GET /patients/:id/egfr` | Creatinina (mg/dL, ≤365 d) + edad + sexo; talla si es pediátrico | eGFR, categoría G, cronicidad, albuminuria | CKD-EPI 2021: adultos ≥18. Schwartz de cabecera: 1–17 años | El médico: el estadio de ERC exige cronicidad ≥90 días, que el endpoint informa pero no certifica | No estadifica ERC con una sola creatinina; no sustituye el aclaramiento medido; el resultado pediátrico NO alimenta la barrera renal de prescripción |
| `GET /patients/:id/cha2ds2vasc` | Problemas activos (CIE-10) + edad + sexo | Puntaje, riesgo, recomendación de anticoagulación | Fibrilación/flutter auricular NO valvular, adultos | El médico: la indicación de anticoagular exige valorar el riesgo hemorrágico, que este sistema **no evalúa** | No calcula HAS-BLED; no emite recomendación si no hay FA activa registrada; no publica porcentaje de riesgo anual |
| `GET /patients/:id/curb65` | BUN (≤2 d) + FR y PA (≤8 h) + edad + confusión declarada | Puntaje, riesgo, recomendación de ingreso, mortalidad (Lim 2003) | Neumonía adquirida en la comunidad, ≥16 años | El médico: la decisión de ingreso integra comorbilidad, soporte social y oxigenación, que el score no ve | No estratifica sin diagnóstico de neumonía activo; no asume la confusión (sin ella devuelve rango, no un valor) |
| `GET /patients/:id/news2` | FR, SpO₂, temperatura, FC, PA sistólica (≤8 h) + O₂ suplementario y conciencia declarados | Puntaje, banda de riesgo, escalamiento | Adultos ≥16 (escala 1; escala 2 en hipercapnia crónica declarada) | El médico/enfermería: el escalamiento depende del protocolo local | No puntúa con datos obsoletos (los excluye y lo declara); con parámetros faltantes el puntaje es una cota inferior, nunca «riesgo bajo» |
| `GET /patients/:id/acid-base` | pH, pCO₂, HCO₃ de la misma muestra (≤1 h) + tipo de muestra + sodio/cloro/albúmina para la brecha | Trastorno primario, compensación esperada, brecha aniónica, delta-delta | Adultos; solo gasometría **arterial** para juzgar compensación | El médico: la causa del trastorno no está en el panel | No interpreta un panel internamente incoherente (Henderson-Hasselbalch); no juzga compensación en muestra venosa o capilar |
| `GET /patients/:id/aa-gradient` | PaO₂ y PaCO₂ de la misma gasometría + FiO₂ declarada + presión atmosférica (altitud de la sede) | PAO₂, gradiente, esperado por edad, PaO₂/FiO₂ | Adultos; el esperado por edad solo con FiO₂ 0.21 | El médico | No calcula sin FiO₂ ni sin presión atmosférica; no compara contra el esperado de aire ambiente cuando hay O₂ suplementario |
| `GET /patients/:id/bp-stage` | Última PA (≤30 d) + edad | Estadio ACC/AHA 2017 y nota de conducta | Adultos ≥18 | El médico: un estadio exige confirmación en tomas repetidas | No estadifica en pediatría (requiere percentiles por edad/sexo/talla); no estadifica una toma con sistólica ≤ diastólica |
| `GET /patients/:id/bmi` | Peso y talla (≤180 d, con unidad) + edad | IMC y categoría WHO | Adultos ≥19 | El médico | No clasifica en pediatría (requiere percentil IMC-para-edad); no clasifica un IMC fuera de 8–100 kg/m² |
| `GET /patients/:id/fib4` | Edad + AST + ALT + plaquetas (10⁹/L) | Índice, riesgo de fibrosis avanzada, corte usado | Adultos; corte bajo ajustado a 2.0 desde los 65 años | El médico: la decisión de referir integra la causa de la hepatopatía | No sustituye elastografía ni biopsia; no interpreta un índice fuera de 0.1–100 (unidad de plaquetas equivocada) |
| `GET /patients/:id/meld` | Bilirrubina + INR + creatinina (+ diálisis, + sodio para MELD-Na) | Puntaje, riesgo, mortalidad a 3 meses (Wiesner 2003) | Hepatopatía avanzada, adultos | El médico y el comité de trasplante | **NO sirve para asignar un órgano**: la asignación usa MELD 3.0 (2021), que este sistema no implementa |
| `GET /patients/:id/charlson` | Problemas activos (CIE-10) + edad | Índice, riesgo, supervivencia estimada a 10 años | Adultos | El médico: el índice no sustituye la valoración funcional | Solo ve lo que está codificado en la lista de problemas: una comorbilidad no registrada no puntúa |
| `GET /patients/:id/anticoagulation-status` | INR + indicación + clase de anticoagulante + sangrado | Estado frente al rango objetivo y conducta escalonada (CHEST) | Pacientes con antagonista de vitamina K | El médico | **No monitoriza anticoagulantes orales directos**: con un ACOD la lectura del INR no es interpretable |
| `GET /patients/:id/glycemic-status` | HbA1c (≤365 d) | Glucosa promedio estimada y categoría (ADA) | Adultos; marco de tamizaje o de metas según diabetes conocida | El médico | No diagnostica diabetes con una sola HbA1c; no interpreta una HbA1c fuera de 3–20 % |
| `GET /patients/:id/metabolic-panel` | Sodio, cloro, HCO₃, calcio, albúmina, glucosa, BUN de la misma extracción (≤24 h) | Brecha aniónica (corregida), calcio corregido, sodio corregido, osmolalidad | Adultos | El médico | El calcio corregido no es fiable en ERC ni con albúmina extrema (lo declara y pide calcio iónico); el sodio no se «corrige» sin hiperglucemia |
| `GET /patients/:id/immunization-forecast` | Fecha de nacimiento + dosis aplicadas con fecha | Estado por dosis del esquema y dosis que no cuentan | Esquema de la Cartilla Nacional (México) | El médico/enfermería | No indica vacunas fuera de su ventana de edad; una dosis que no cumple edad o intervalo mínimos NO acredita la serie |
| `POST /patients/:id/prescription-check` | Fármaco, dosis, vía, frecuencia, duración + expediente | Veredicto de las 10 barreras de seguridad | Los fármacos del catálogo (72 principios activos) | El médico: un bloqueo anulable se levanta con justificación registrada | Un fármaco fuera del catálogo devuelve `NOT_EVALUATED` en todas las barreras: **no verificado no es seguro** |

## Lo que sigue siendo del dueño del producto

1. **Determinación de intended-use y clasificación de riesgo** por módulo (Regulatory). Hasta que exista, el registro NOM
   dice «pendiente de determinación», no «fuera de alcance».
2. **Validación clínica de todo el contenido** (umbrales, tablas de fármacos, esquema de vacunación, máximos mg/kg): el
   código declara sus fuentes, pero ninguna ha sido firmada por un médico responsable.
3. Si la determinación concluye que algún módulo es dispositivo médico: sistema de gestión de calidad, expediente técnico
   y el resto de lo que exige la norma.
