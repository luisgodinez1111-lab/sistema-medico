# Gobernanza de contenido clínico

- **Referencias del plan:** §33 #8 (contenido clínico versionado, con fuente + versión + reviewer)
- **Estado:** proceso activo. Todo el contenido clínico embebido está hoy marcado **DEMO** y debe
  ser **validado por un clínico** antes de presentarse como clínicamente correcto.

## Principio

El contenido clínico (interacciones, guías, catálogos por especialidad, sugerencias del copiloto)
es **estructurado y versionado**, nunca texto libre ni fabricado como validado. Cada pieza declara:

- **`version`** — versión del contenido (para trazabilidad y auditoría).
- **`source`** — origen: `demo` (no validado) o una fuente citable cuando esté validado.
- **reviewer + fecha** — quién lo revisó clínicamente y cuándo (al promover a validado).

Mientras `source = demo`, la UI lo muestra **explícitamente marcado "DEMO (no validado clínicamente)"**
y el copiloto **sugiere, no decide** (human-in-the-loop). Nada de esto se presenta como consejo
clínico validado.

## Inventario de contenido DEMO (a validar)

| Contenido | Módulo | Constantes | Estado |
| --- | --- | --- | --- |
| Interacciones fármaco-fármaco | `prescription-safety.ts` | `INTERACTIONS_DATASET_VERSION`, `INTERACTIONS_SOURCE`, `source:'demo'` | DEMO |
| Care pathways / guías | `pathways.ts` | `PATHWAYS_VERSION`, `PATHWAYS_SOURCE` | DEMO |
| Specialty packs (secciones, quick-picks, order sets, pathways) | `specialty-packs.ts` | `SPECIALTY_PACK_SCHEMA_VERSION`, `SPECIALTY_PACK_SOURCE`, `source:'demo'` | DEMO |
| Copiloto clínico (motor + sugerencias) | `ai-copilot.ts` | `AI_POLICY_VERSION`, `AI_ENGINE='stub-demo (no IA)'` | DEMO (ver [[r6-paused]]) |

Contenido **no clínico / estructural** (no requiere validación clínica de contenido, solo de esquema):
`HISTORY_SCHEMA_VERSION`, `COMPLETENESS_RULESET_VERSION`, `SAFETY_RULESET_VERSION` (reglas
deterministas: alergia-contraindicación, terapia duplicada), `FHIR_VERSION` (estándar externo 4.0.1).

## Reglas deterministas vs. catálogos

En `prescription-safety.ts` conviven dos orígenes:

- **`source: 'rule'`** — reglas deterministas de seguridad (alergia documentada ⇒ contraindicación,
  duplicidad terapéutica). No son "contenido clínico opinable"; son invariantes de seguridad y
  **no** dependen de un catálogo externo.
- **`source: 'demo'`** — catálogo de interacciones no validado. Es lo que debe reemplazarse por una
  fuente licenciada/validada.

Nunca degradar una regla `'rule'` a `'demo'` ni ocultar una alerta crítica tras contenido DEMO (§27).

## Proceso de promoción DEMO → validado

1. **Fuente**: seleccionar una fuente citable (guía de práctica, vademécum licenciado, lineamiento
   oficial). Registrar la referencia.
2. **Revisión clínica**: un clínico responsable revisa el contenido contra la fuente.
3. **Marcado en código**: cambiar `source` de `demo` a la fuente, subir `version`, y registrar
   `reviewer` + fecha (en el propio módulo o en un registro de contenido). Retirar la etiqueta
   "DEMO" de la UI para esa pieza.
4. **Pruebas**: las pruebas de estructura/motor no cambian; añadir casos si el contenido validado
   introduce nuevas reglas.
5. **Auditoría**: los cambios de contenido clínico quedan trazables por `version` (y, para el
   copiloto, por el `policyVersion` que ya se registra como provenance en `audit_event`).

## Qué NO hacer

- No presentar contenido DEMO como validado ni retirar la marca "DEMO" sin revisión clínica.
- No fabricar interacciones, dosis, guías ni fuentes.
- No mover la decisión clínica al software: el copiloto y los packs **sugieren**; el clínico decide.

> **Nota:** la validación clínica requiere un **revisor humano** con responsabilidad profesional.
> La ingeniería deja el mecanismo listo (estructura, versión, marcado, provenance); la promoción a
> "validado" es una decisión clínica, no de código.
