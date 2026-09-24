# Evaluación de riesgo de los peligros clínicos: qué hay, qué falta y por qué no se inventa
> Autoridad: auditoría 2026-09-19, anexo R09 (R09-026). Acompaña a `safety/core-hazards.json` y
> `safety/controls/catalog.json`, que son los artefactos que los gates leen.

## El hallazgo

R09-026 decía: «los 6 hazards documentados usan una sola severidad (S1) sin probabilidad ni matriz de riesgo». Al medirlo
son **13**, y es peor de lo que el anexo describe: los trece llevaban `severity: "S1"` y **nada más** — ni probabilidad, ni
clase de riesgo, ni detectabilidad, ni aceptación de riesgo residual.

Con un solo eje no existe evaluación de riesgo. El riesgo es **severidad × probabilidad**: si todos los peligros son de
severidad máxima y nadie estima la probabilidad, el campo `severity` no transporta información, no se puede priorizar nada
y no hay forma de justificar por qué un riesgo residual es aceptable. Un registro así parece una evaluación de riesgo y no
lo es, que es exactamente el patrón que esta auditoría persigue.

## Lo que NO se hizo, a propósito

**No se inventaron probabilidades.** Asignar la probabilidad de un peligro clínico es un juicio clínico y regulatorio del
fabricante (ISO 14971), no una decisión de ingeniería. Una cifra inventada sería peor que el hueco: convertiría una laguna
visible en una evaluación falsa que alguien podría firmar. Los trece peligros declaran
`probability: "PENDIENTE DE DETERMINACION"` y `riskClass: "NO EVALUADO"` con el motivo escrito.

## Lo que sí se hizo

1. **La severidad declara su base.** `severityBasis` dice que S1 viene del daño potencial descrito en cada peligro —los
   trece describen daño clínico directo a un paciente—, no de una omisión ni de un valor por omisión.
2. **La clase de riesgo declara que no está evaluada, y por qué.** Antes el hueco era silencioso.
3. **La aceptación de riesgo residual queda nombrada como decisión del dueño** y remite a ADR-0300, donde vive la lista
   única de condiciones de admisión a producción.
4. **La detectabilidad se ancla en algo verificable.** Lo único que la ingeniería puede determinar aquí es si el control que
   debería detectar el peligro **existe y se ejecuta**. Y ahí apareció el segundo defecto:

## El defecto que apareció al mirar los controles

Los 15 controles declaran un campo `verification`. Siete de ellos lo declaraban con **etiquetas simbólicas**
(`unit:test-result-closure`, `state-machine:result-lifecycle`, `reconciliation:due-date-scan`…) que **ningún gate resolvía**
y a las que **no correspondía ningún fichero**. Es decir: el control decía estar verificado por algo que no existía con ese
nombre, y nadie lo comprobaba. Los otros ocho ya citaban rutas reales (`unit:tests/…`, `live:scripts/…`), señal de que la
convención se había migrado a medias.

Las etiquetas eran una convención que perdió su resolvedor —`unit:test-X` correspondía a `tests/traceability/X.test.ts`—,
así que la migración fue mecánica y verificable, con dos excepciones que se resolvieron por su contenido, no por su nombre:

| Etiqueta antigua | Artefacto real |
| --- | --- |
| `unit:test-result-closure` | `tests/traceability/state-machines.test.ts` + `scripts/v22/live-result-closed-loop-proof.mts` |
| `reconciliation:due-date-scan` | `scripts/v22/live-care-gaps-proof.mts` |
| `contract:applicability` | retirada: el control ya citaba su test y su prueba en vivo |

Ahora **las 24 referencias de verificación de los 15 controles resuelven a un fichero que existe**, y
`tests/v22/hazard-risk-integrity.test.ts` falla si alguna deja de resolver o si alguien vuelve a introducir una etiqueta sin
ruta.

## Lo que falta para tener una evaluación de riesgo de verdad

Todo esto es del dueño, y está en ADR-0300:

- **Probabilidad por peligro**, estimada con criterio clínico y, donde se pueda, con datos.
- **Matriz de riesgo** (severidad × probabilidad) con los umbrales de aceptación declarados.
- **Aceptación de riesgo residual** firmada por quien puede firmarla.
- **Validación clínica** de los trece peligros: que estén bien descritos y que no falte ninguno.
