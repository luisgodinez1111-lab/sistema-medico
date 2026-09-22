# Registro de trazabilidad V2.1 — estado real (auditoría 2026-09-19, G-02)

Estos CSV y el `.xlsx` son los **artefactos de la especificación de ingeniería V2.1**, versionados tal cual se
entregaron. `HAZ_Registry.csv` (256 peligros) e `INV_Registry.csv` (303 invariantes) son **plantillas de una frase por
átomo ENG** ("Failure or semantic violation of ENG-xxx may create unsafe… behavior"), no un análisis de peligros: no
identifican una condición peligrosa concreta, una secuencia previsible ni un daño, y ningún gate los lee.

**El registro de seguridad ejecutable es otro**: `safety/core-hazards.json`, `safety/controls/catalog.json`,
`safety/core-invariants.json` y `capabilities/catalog.json`, cuyos casos se generan en `safety/cases/` y cuyos gates
(`pnpm release:check`: RG-014/015/016) exigen que cada peligro tenga control, cada control invariante y cada invariante
un predicado y un test. Desde el lote 10c de la remediación, ese registro contiene los peligros reales de la
prescripción (HAZ-CORE-0007…0010) con oráculos sobre el código que corre (`tests/traceability/medication-safety.test.ts`).

Lo que falta para cerrar G-02 es **contenido**, no formato: un análisis de riesgos ISO 14971 por función clínica
(calculadoras, gate de firma, resultados críticos, vacunación, agenda) redactado y validado con un médico y con el
responsable regulatorio del dueño (G-04). Esta carpeta se conserva como referencia de la especificación; no debe citarse
como evidencia de seguridad.
