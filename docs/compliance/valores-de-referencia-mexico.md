# Valores de referencia y umbrales clínicos — marco normativo mexicano

**Fecha:** 25-sep-2026 · **Origen:** decisión D4 del [cotejo de guías clínicas](cotejo-de-guias-clinicas.md) · **Estado:** PREPARATORIO

## Lo primero, porque cambia la respuesta

La instrucción fue «crea la tabla de valores referenciales en guías mexicanas». Al buscarlos hay que separar **dos cosas que
suelen confundirse**, porque tienen dueños distintos:

1. **Umbrales DIAGNÓSTICOS y METAS de tratamiento** — sí existen en la normativa mexicana y en las Guías de Práctica Clínica
   del sector salud: qué glucemia define diabetes, qué presión define hipertensión, qué meta de HbA1c se persigue. Son
   decisiones de política sanitaria y están publicadas.
2. **VALORES DE REFERENCIA de laboratorio y VALORES CRÍTICOS (de pánico)** — **no los fija ninguna NOM**, y no es un vacío:
   es lo que la propia norma ordena. La **NOM-007-SSA3-2011** (organización y funcionamiento de laboratorios clínicos)
   establece que **cada laboratorio debe determinar, verificar y documentar sus propios intervalos de referencia** y su lista
   de valores críticos, porque dependen del método analítico, del equipo, del reactivo y de la población que atiende.

Es decir: **la tabla de valores críticos no se puede sacar de una guía. Tiene que venir del laboratorio del consultorio.**
Cualquier documento que publicara una tabla universal de valores de pánico estaría inventando autoridad donde la norma la
asigna a otro. Lo que este documento hace es (a) fijar lo que sí es normativo, (b) dejar el formato exacto en el que el
laboratorio debe entregar lo suyo, y (c) declarar qué analitos siguen con umbrales de demostración mientras eso no llegue.

> **Verificar vigencia.** Las NOM se actualizan y se sustituyen. Cada instrumento citado aquí lleva su clave completa para que
> se pueda comprobar en el Diario Oficial de la Federación antes de firmar. El corte de conocimiento de quien redactó este
> documento es mayo de 2026.

---

## Parte 1 — Lo que sí es normativo en México

Estos umbrales no son intervalos de referencia de laboratorio: son **criterios diagnósticos y metas** con fuente nacional.

| Dominio | Instrumento mexicano | Qué fija | Estado en el sistema |
| --- | --- | --- | --- |
| Diabetes mellitus | **NOM-015-SSA2-2010**, para la prevención, tratamiento y control de la diabetes mellitus | Criterios diagnósticos por glucemia y metas de control (incluida HbA1c) | Las metas viven en `packages/care-goals` citando ADA. **Pendiente: añadir la cita nacional** |
| Hipertensión arterial | **NOM-030-SSA2-2009**, para la prevención, detección, diagnóstico, tratamiento y control de la hipertensión arterial sistémica | Clasificación de la presión arterial y metas | `packages/bp-staging` cita ACC/AHA 2017. **Pendiente: cotejar con la clasificación nacional (decisión D5)** |
| Dislipidemias | **NOM-037-SSA2-2012**, para la prevención, tratamiento y control de las dislipidemias | Categorías de colesterol total, LDL, HDL y triglicéridos | El sistema NO declara meta de LDL (correcto: depende del riesgo). **Pendiente: mostrar las categorías nacionales** |
| Expediente clínico | **NOM-004-SSA3-2012** | Qué debe contener y cómo se registra | Ya registrado en `nom-applicability-register.json` |
| Registro electrónico | **NOM-024-SSA3-2012** | Interoperabilidad y estructura del registro electrónico | Ya registrado |
| Laboratorio clínico | **NOM-007-SSA3-2011** | **Obliga a cada laboratorio a establecer sus propios intervalos de referencia y valores críticos** | **Es la norma que gobierna la Parte 2 de este documento** |
| Sangre y transfusión | **NOM-253-SSA1-2012** | Disposición de sangre humana y sus componentes | La vertical de transfusiones está apagada por bandera (L-10/L-11) |
| Embarazo, parto y puerperio | **NOM-007-SSA2-2016** | Atención de la mujer durante el embarazo | El sistema no modela el embarazo (R03-29, declarado) |
| Vacunación | Cartilla Nacional de Salud / esquema del sector | Esquema de vacunación por edad | `packages/immunization-schedule`. **Pendiente: cotejar con el esquema nacional vigente** |

**Cómo se usa esta parte:** cada fila con «Pendiente» es trabajo de ingeniería que puedo hacer en cuanto se confirme la
vigencia del instrumento. No lo he hecho por mi cuenta porque citar una NOM equivocada o derogada en una pantalla clínica es
peor que no citar ninguna.

---

## Parte 2 — Valores de laboratorio: lo que tiene que entregar el laboratorio

El sistema usa hoy **28 analitos** con cuatro números cada uno —crítico bajo, límite bajo de lo normal, límite alto de lo
normal, crítico alto— y el módulo declara por escrito que son **«umbrales de adulto de demostración»**.

**Por qué esto importa más que ninguna otra tabla del sistema.** Esos cuatro números no son decorativos: gobiernan

- el **lazo de resultado crítico** (un valor crítico abre una obligación URGENTE a 24 h con responsable asignado),
- el **bloqueo de la firma del encuentro** (un resultado crítico sin cerrar impide firmar la nota), y
- la **interpretación que lee el médico** (normal / anormal / crítico).

Un umbral mal puesto no produce un número feo: produce una obligación urgente que no debía existir, o —al contrario— un
potasio letal presentado como anormal leve.

### Formato exacto en el que se necesita

Pide a tu laboratorio esta tabla. Es lo que la NOM-007-SSA3-2011 les exige tener documentado, así que no es un favor: es su
obligación y debería poder entregarla firmada.

| Columna | Qué es | Ejemplo |
| --- | --- | --- |
| `analito` | Nombre y, si lo tienen, código LOINC | Potasio · LOINC 2823-3 |
| `unidad` | Unidad en la que reportan | mEq/L |
| `metodo` | Método analítico y equipo | Electrodo selectivo de iones · Cobas 6000 |
| `poblacion` | Estrato al que aplica | Adulto · Hombre · 18–65 años |
| `ref_bajo` / `ref_alto` | Intervalo de referencia (lo NORMAL) | 3.5 / 5.1 |
| `critico_bajo` / `critico_alto` | Valor crítico (de pánico) que obliga a notificar | 2.5 / 6.5 |
| `sin_critico` | Marcar cuando ese extremo no tiene valor crítico | (vacío) |
| `vigencia` | Fecha desde la que aplica y responsable que la firma | 2026-01-15 · QFB responsable |

**Los 28 analitos que el sistema necesita:** glucosa, potasio, sodio, hemoglobina, leucocitos, plaquetas, creatinina, INR,
lactato, troponina, calcio, magnesio, fósforo, cloro, bicarbonato, urea (BUN), ALT, AST, bilirrubina total, albúmina, pH,
pCO₂, pO₂, HbA1c, TSH, BNP, dímero D, proteína C reactiva, colesterol LDL y cociente albúmina/creatinina en orina.

Tres precisiones que evitan una segunda vuelta con el laboratorio:

1. **Estratos.** El sistema ya distingue por sexo y edad donde la evidencia lo exige (por ejemplo el piso de hemoglobina, que
   con un único valor de 12 g/dL daba por normal a un varón anémico). Si el laboratorio estratifica, mándalo estratificado.
2. **Extremos sin valor crítico.** Hay analitos con crítico solo en un extremo —la albúmina y el pO₂ del sistema son así—. Que
   lo marquen en lugar de inventar un número imposible: el sistema ya sabe representar «sin umbral».
3. **Unidades.** Si reportan en unidades distintas a las del sistema (por ejemplo creatinina en µmol/L), dilo: el sistema
   convierte, pero necesita saberlo. Una creatinina de 90 es normal en µmol/L y catastrófica en mg/dL.

### Qué hago yo cuando llegue

1. Parametrizo los 28 analitos con sus estratos, sustituyendo los umbrales de demostración.
2. Ato cada valor a su fuente en el propio código: laboratorio, método, fecha de vigencia y quién lo firmó.
3. Añado una prueba que falla si un analito se queda sin fuente declarada, igual que la que impide que un algoritmo clínico
   viva sin ficha.
4. Corro las pruebas en vivo para comprobar que el lazo de resultado crítico y el bloqueo de firma siguen funcionando con los
   umbrales reales.

**Mientras no llegue**, el sistema seguirá declarando en la pantalla y en el código que los umbrales son de demostración. Eso
es lo único honesto que se puede hacer, y es también lo que impide que se use en producción clínica sin esa decisión.

---

## Qué NO hace este documento

- **No publica una tabla universal de valores de pánico.** No existe, y la norma mexicana asigna esa responsabilidad al
  laboratorio.
- **No cita textualmente ninguna NOM.** Da la clave completa para que se verifique en el Diario Oficial; transcribir de
  memoria el texto de una norma es la clase de error que esta auditoría persigue.
- **No sustituye la validación clínica.** Igual que el cotejo de guías, prepara la decisión; no la toma.
