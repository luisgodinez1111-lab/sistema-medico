# Manual del clínico — qué significa cada aviso y qué hacer ante él

**Para quién:** el médico que usa este sistema en consulta. No es documentación técnica.

**Qué es y qué no es.** Este documento explica **qué significa exactamente** cada estado, aviso o bloqueo que la pantalla
puede mostrarte, y **qué se espera que hagas** ante cada uno. No explica cómo se usa la interfaz (eso se ve usándola):
explica lo que no se puede adivinar mirando, que es la **diferencia entre «se comprobó y está bien» y «no se pudo
comprobar»**. Esa distinción es el eje de todo el sistema y la razón de ser de este manual.

**La regla que lo gobierna todo.** Este sistema **nunca dice «seguro»**. Dice «se evaluó y no encontré conflicto», o dice
«no pude evaluarlo». Son cosas distintas y la pantalla jamás las mezcla. Si lees una palabra que no entiendes, búscala
aquí: si no está, es un defecto del sistema y hay que reportarlo — no una palabra que debas interpretar por tu cuenta.

**Lo que este sistema NO hace.** No diagnostica, no prescribe y no decide. Verifica contra reglas deterministas y
catálogos declarados, y te dice qué encontró y qué no pudo mirar. La decisión clínica es tuya y queda firmada con tu
identidad. No hay inteligencia artificial generativa en ninguna de las comprobaciones de este documento.

---

## 1. Prescripción: el veredicto de seguridad

Al prescribir, el sistema evalúa nueve barreras y emite **un veredicto**:

| Veredicto | Qué significa | Qué hacer |
|---|---|---|
| **CLEAR** | Todo lo que **se podía** evaluar pasó. **No significa «seguro»**: significa que ninguna de las barreras evaluables encontró conflicto. | Prescribir con tu criterio. |
| **REVIEW** | Hay advertencias, o hay barreras que **no se pudieron evaluar**. | Leer qué barrera y por qué. Si falta un dato (peso, eGFR), registrarlo y volver a verificar. |
| **BLOCK** | Al menos una barrera **bloquea**. | Corregir la orden, o anular el bloqueo bajo tu responsabilidad si es anulable (§3). |

## 2. El estado de cada barrera: la distinción que importa

Cada barrera informa su propio estado. Las tres últimas son las que **no** quieren decir «bien»:

| Estado | Qué significa | Qué hacer |
|---|---|---|
| **PASSED** | Se evaluó y no hay conflicto. | Nada. |
| **CAUTION** | Se evaluó: requiere tu atención, no bloquea. | Leer el detalle y decidir. |
| **BLOCKED** | Se evaluó: bloquea la prescripción. | Ver §3. |
| **NOT_APPLICABLE** | La barrera no aplica a este paciente (p. ej. dosis pediátrica en un adulto). | Nada. |
| **NOT_COVERED** | El catálogo **no tiene regla** para este fármaco. **No se evaluó.** Es informativo, **no es «seguro»**. | Verificar tú lo que la regla habría verificado. |
| **NOT_EVALUATED** | Debía evaluarse y **no se pudo**. | Resolver la causa (abajo) y volver a verificar. Si prescribes así, el sistema te pedirá confirmarlo (§4). |

### Por qué una barrera queda sin evaluar

| Motivo | Qué falta | Qué hacer |
|---|---|---|
| **DRUG_NOT_IN_CATALOG** | El fármaco que prescribes no está en el catálogo. | Ninguna barrera pudo mirarlo. Verificar manualmente alergia, interacciones, dosis y ajuste renal. |
| **ACTIVE_DRUGS_NOT_IN_CATALOG** | Algún fármaco **activo del paciente** no está en el catálogo. | La interacción con ESE fármaco no se evaluó. Revisarla tú. |
| **NO_RULE_IN_CATALOG** | El fármaco está, pero sin regla para esta barrera. | Verificar manualmente esa dimensión. |
| **NO_EGFR** | No hay creatinina/eGFR del paciente. | Registrar una creatinina; el ajuste renal no se puede calcular sin ella. |
| **NO_WEIGHT** / **WEIGHT_REQUIRED** | Falta el peso. | Registrar el peso. En pediatría la dosis por kg **no se evalúa** sin él. |
| **NO_DURATION** | No indicaste duración. | Indicarla: hay fármacos con techo de días (ketorolaco 5, metamizol 7). |
| **DOSE_NOT_PARSEABLE** | La dosis no se pudo interpretar. | Escribirla con cantidad y unidad explícitas (p. ej. «850 mg»). |
| **ADULT_PATIENT** | La barrera es pediátrica y el paciente es adulto. | Nada: es `NOT_APPLICABLE`, no un fallo. |

## 3. Un bloqueo que puedes anular y uno que no

Un bloqueo **no es siempre** una negación absoluta. Hay bloqueos que la práctica clínica anula bajo criterio y
responsabilidad del médico, y hay bloqueos que este sistema **nunca** anula porque no existe escenario clínico que los
justifique: ahí lo que procede es **corregir la orden**.

| Barrera | ¿Anulable? | Si bloquea |
|---|---|---|
| **Alergia documentada** (`allergy`) | Sí | Anular con justificación si no hay alternativa (p. ej. desensibilización programada). |
| **Interacción farmacológica mayor** (`interaction`) | Sí | Anular con justificación y plan de monitorización. |
| **Duplicidad terapéutica** (`duplicate`) | Sí | Anular si la duplicidad es intencional y lo justificas. |
| **Contraindicación por diagnóstico** (`contraindication`) | Sí | Anular si es relativa y lo justificas. |
| **Ajuste renal (eGFR)** (`renal`) | Sí | Anular si procede (p. ej. paciente en diálisis). |
| **Orden mal formada** (`order`) | **No** | Corregir la orden. |
| **Fármaco fuera de catálogo** (`catalog`) | **No** | No hay nada que anular: no se evaluó. Verificar manualmente. |
| **Dosis por encima del máximo diario** (`doseCeiling`) | **No** | Corregir la dosis. |
| **Duración por encima del máximo** (`duration`) | **No** | Corregir la duración. |
| **Dosis pediátrica por peso** (`pediatricDose`) | **No** | Registrar el peso o corregir la dosis. |

**Cómo se anula.** Hay que **nombrar cada barrera** que anulas y escribir una **justificación clínica de al menos 20
caracteres**. Queda inmutable en el expediente, con tu identidad y la hora. No es un trámite: es la constancia de que la
decisión fue tuya y por qué.

## 4. «428 — Se requiere tu confirmación» (SAFETY_ACK_REQUIRED)

**Qué pasó.** Intentaste prescribir y había barreras **sin evaluar** (`NOT_EVALUATED`) o **sin regla** (`NOT_COVERED`).
El sistema **no te lo impide**: te exige reconocer **explícitamente** que prescribes sin verificación automática
completa.

**Qué hacer.** Leer qué barreras quedaron sin evaluar y por qué. Si falta un dato, registrarlo y reintentar: es casi
siempre más rápido que asumir el riesgo. Si decides continuar, tu reconocimiento queda registrado.

**Lo que NO significa.** No significa que el fármaco sea peligroso ni que sea seguro. Significa **que el sistema no lo
sabe**, y que de aquí en adelante lo sabes tú.

## 5. Signos vitales y resultados de laboratorio

| Estado | Qué significa | Qué hacer |
|---|---|---|
| **NORMAL** | Dentro del rango de referencia que el sistema aplica para la edad del paciente. | Nada. |
| **ABNORMAL** | Fuera de rango, sin ser crítico. | Valorar. Un resultado anormal abre un seguimiento de rutina. |
| **CRITICAL** | Valor de pánico. | **Actuar el mismo día.** Abre una obligación URGENTE que **bloquea la firma** de la consulta hasta cerrarse con evidencia. |
| **UNKNOWN** | **No se pudo clasificar**: no hay rango para ese analito/signo, o la unidad o el valor no se pudieron interpretar. | **No es «normal».** Interpretarlo tú. Si la unidad está mal, corregirla. |

**Los límites son inclusivos.** Un valor que cae exactamente en el borde crítico **es** crítico.

**Enmendar un valor.** Un signo vital mal capturado se **enmienda**, no se borra: se registra el valor corregido con el
motivo, y el valor anterior **sigue en el expediente**. Si el registro es de otro paciente o nunca ocurrió, eso se
**marca como error**, que es distinto de corregirlo.

## 6. Interacciones y alergias: qué dice cada gravedad

| Gravedad de interacción | Qué significa |
|---|---|
| **CONTRAINDICATED** | No deben coadministrarse. |
| **MAJOR** | Riesgo clínicamente relevante: exige decisión y, si procede, monitorización. |
| **MODERATE** | Requiere vigilancia o ajuste. |
| **MINOR** | Relevancia clínica limitada. |

| Gravedad de alergia | Qué significa |
|---|---|
| **MILD** / **MODERATE** / **SEVERE** | La que tú registraste. El sistema **no la deduce** de la reacción. |

**El catálogo de interacciones de este sistema es acotado y lo declara.** Que no aparezca una interacción **no** significa
que no exista: significa que no está en el catálogo. Esta limitación está anotada en la auditoría del repositorio
(R05b-12) y su sustitución por una fuente comercial es una decisión pendiente del propietario.

## 7. Ajuste renal

| Acción | Qué significa | Qué hacer |
|---|---|---|
| **OK** | Se evaluó: la dosis es apropiada para el eGFR. | Nada. |
| **CAUTION** | Se evaluó: ajustar o vigilar. | Ajustar según la nota. |
| **BLOCK** | Se evaluó: contraindicado a este eGFR (p. ej. metformina con TFG < 30). | Corregir o anular con justificación. |
| **NOT_COVERED** | El catálogo no tiene regla renal para este fármaco. | Verificar tú. |
| **NOT_EVALUATED** | Falta el eGFR, o el fármaco no está en catálogo. | Registrar creatinina. **No es «sin ajuste necesario»**. |

## 8. Seguimientos (obligaciones): plazos y qué bloquea la firma

| Prioridad | Plazo por omisión | Origen del plazo |
|---|---|---|
| **URGENT** | 24 h (mismo día) | Es el plazo que el sistema aplica al resultado crítico. Una obligación urgente vencida **bloquea la firma**. |
| **HIGH** | 72 h | Decisión **operativa** de este sistema, no una norma citada. |
| **ROUTINE** | 7 días, **sin techo** | Por omisión; sin techo a propósito, porque «HbA1c en 3 meses» es un seguimiento legítimo de rutina. |

**Por qué se bloquea una firma.** El sistema impide firmar la consulta por tres motivos, y siempre dice cuál:

| Motivo | Qué significa | Qué hacer |
|---|---|---|
| **URGENT** | Hay un seguimiento urgente abierto (típicamente un resultado crítico sin cerrar). | Cerrarlo con evidencia de qué hiciste. |
| **OVERDUE** | Hay un seguimiento vencido. | Cerrarlo o replanificarlo. |
| **INVALID_DUE_DATE** | La fecha límite de un seguimiento es ilegible. | Corregir la obligación: el sistema **no supone** que esté al día. |

**Cerrar un seguimiento crítico exige evidencia sustantiva** (mínimo 10 caracteres describiendo qué se hizo, cuándo y con
qué resultado). Un punto o un espacio no cierran nada: es el punto donde afirmas «contacté y traté al paciente».

## 9. Conciliación de medicamentos

Conciliar es comparar **lo prescrito** con **lo que el paciente realmente toma**. Cada fármaco en curso muestra:

- **«Sin conciliar: no consta si el paciente lo sigue tomando»** — no es un olvido de la pantalla: es el estado real. Suponer que lo toma es la suposición peligrosa.
- **Lo sigue tomando igual** / **Lo toma distinto a lo prescrito** / **Se suspende en esta conciliación** / **NO lo está tomando**.

Al conciliar se pide **contra qué lo comprobaste** (el paciente, un cuidador, la receta anterior, el registro de la
farmacia, las cajas que trae). Sin fuente, una conciliación no se puede auditar, y por eso es obligatoria.

**«NO lo está tomando» exige que expliques por qué, y NO suspende el fármaco.** Encontrar que no lo toma no es
suspenderlo: la decisión —suspender, reeducar, cambiar el esquema— la tomas tú después, y pasa por sus propias barreras.

## 10. El resumen del paciente y su semáforo

El resumen muestra uno de tres estados, y el tercero es el que suele faltar en otros sistemas:

| Chip | Qué significa | Qué hacer |
|---|---|---|
| **Alerta** (rojo/ámbar) | Hay hallazgos o pendientes de alta prioridad. | Leerlos. |
| **Sin alertas** (verde) | Se evaluó y no hay hallazgos accionables. | Nada. |
| **No se pudo comprobar** (ámbar) | **El sistema no pudo evaluar** los pendientes del paciente (fallo de carga). | **No es «sin alertas»**. Reintentar; no decidir como si estuviera despejado. |

La misma regla aplica en todas las pantallas: ante un fallo de carga, el sistema **dice que falló**; nunca rellena con
ceros ni con «sin hallazgos».

## 11. Triage de urgencias (si tu consultorio lo usa)

El nivel **ESI 1–5 no se teclea**: lo deriva el sistema de los discriminadores que respondes (riesgo vital, alto riesgo,
zona de peligro de signos vitales por edad, número de recursos previstos). Si falta un dato necesario, **no se clasifica**
y se dice — no se asigna un nivel por omisión.

**El plazo de reevaluación que muestra la pantalla es de CTAS, no de ESI**, y la pantalla lo etiqueta así: ESI no publica
tiempos de reevaluación.

## 12. La nota de la consulta y su firma

- La **valoración y el plan** que escribes se guardan y **se pueden volver a leer**, con su fecha y su firmante, desde *Historia clínica → Consultas de este paciente*.
- Una consulta **sin firmar es un borrador** y la pantalla lo dice: no tiene valor legal como nota médica.
- Una nota firmada **no se edita: se enmienda.** La enmienda queda con su fecha y su motivo, y la nota original permanece.
- **Cada lectura de una nota queda registrada** en la bitácora de accesos al expediente, con quién, cuándo y con qué propósito. Es un requisito de protección de datos, no vigilancia del médico.

## 13. Fechas

Toda fila del expediente muestra **cuándo se registró** el dato y, si cambió otro día, **cuándo cambió**
(«2 mar 2026 · act. 18 sep 2026»). Las horas son la **hora local del consultorio**.

Si una fecha no se puede leer, la pantalla escribe **«sin fecha»** o **«fecha ilegible»** en lugar de dejar un hueco: un
hueco sería indistinguible de un diseño sin fechas, y una fecha ausente en un expediente hay que poder verla.

---

## Si algo no está en este manual

Si la pantalla te muestra una palabra o un código que **no aparece aquí**, trátalo como un defecto del sistema y
repórtalo. Un aviso que el médico tiene que interpretar por su cuenta no es un aviso: es una adivinanza, y en un
expediente clínico eso es un riesgo.

Este documento se mantiene **verificado contra el código**: una prueba automática
(`tests/v22/clinician-manual.test.ts`) comprueba que cada estado que el sistema puede mostrar está documentado aquí y que
este manual no documenta estados que ya no existen. Si el sistema añade un aviso nuevo y nadie lo explica aquí, la prueba
falla y el cambio no entra.

**Lo que este manual no cubre, y por qué.** Los umbrales clínicos concretos (qué valor es crítico para cada analito, qué
dosis máxima aplica a cada fármaco) viven en los catálogos del sistema con su fuente citada, no aquí: duplicarlos en un
documento garantizaría que algún día digan cosas distintas. Y la **validación clínica** de esos umbrales por un médico
responsable está pendiente y así se declara en la auditoría del repositorio (R09-020, R09-025): este manual explica qué
significa cada aviso, no afirma que cada umbral esté validado.
