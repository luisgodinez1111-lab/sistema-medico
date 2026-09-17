# Compliance — Registro de aplicabilidad (ENG-044)

> Autoridad: **ENG-044** (México Compliance-as-Code baseline). Endurecimiento eje G, Epic BI (2026-09-17).

## Qué es esto (y qué NO es)

Este directorio contiene el **registro de aplicabilidad** regulatoria, no una declaración de cumplimiento
total ni de certificación. Siguiendo ENG-044-R001, usamos un **applicability register** en vez de reclamar
"todas las NOMs". Ley no negociable (SPEC_INDEX): **"No claim de certificación sin evidencia"**.

- `nom-applicability-register.json` — cada instrumento aplicable (NOM/ley) con: alcance, nivel de aplicabilidad,
  estado, **evidencia técnica enlazada** (capacidades adjudicadas + artefactos que existen) y **brechas conocidas**.
- Enforzado por `tests/v22/nom-compliance-integrity.test.ts`: valida estructura, exige que **toda evidencia
  citada exista** (archivo en disco o CAP en la reconciliación), y prohíbe declarar certificación sin evidencia.

## Instrumentos en el baseline

| Instrumento | Aplicabilidad | Estado | Abordado por (resumen) |
| --- | --- | --- | --- |
| NOM-004-SSA3-2012 (expediente clínico) | APPLICABLE | PARTIAL | Event store append-only + cadena de auditoría; consentimiento; recuperabilidad |
| NOM-024-SSA3-2012 (SIRES / interoperabilidad) | APPLICABLE | PARTIAL | Export/manifiesto con hash reproducible; datos CIE-10 codificados |
| LFPDPPP (datos personales) | APPLICABLE | PARTIAL | RLS por tenant; authz por purpose-of-use; telemetría sin PHI |
| NOM-151-SCFI-2016 (conservación) | EVALUATE_WHEN | EVALUATE | Base de integridad temporal por hash encadenado; constancia formal pendiente |
| NOM-241-SSA1-2025 (dispositivos) | EVALUATE_WHEN | NOT_STARTED | Fuera del alcance actual; se re-evalúa por intended-use |

## Cómo mantenerlo honesto

- Al cerrar una brecha, agrega la evidencia (CAP-id o ruta de artefacto) a la entrada; el guard verifica que exista.
- **Nunca** cambies `certificationClaimed` a `true` sin evidencia real de auditoría externa (el guard lo bloquea).
- Modelos de amenaza en `docs/threat-models/`.
