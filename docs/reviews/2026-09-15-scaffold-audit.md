# Auditoría del Scaffold `medical-os` vs los 3 Documentos (15-sep-2026)

Foco #3. Consistencia del scaffold (v21.0, ahora repo baseline) contra V2.0.1 (Product),
V2.1.1 (Engineering) y el Companion (Execution), usando el Registro de Trazabilidad.

## Veredicto

El scaffold es una **fundación governance-first, honesta y profundamente verificada** — un
**kernel de seguridad + golden vertical slice a nivel de datos/dominio** — **no** una
implementación completa de V2, y **no pretende serlo** (`release_state: BLOCKED`, todo
deny-by-default). **No se encontró ninguna contradicción con los 3 documentos:** el scaffold
encarna sus invariantes (EXEC-0003, jerarquía de autoridad, fail-closed, no-orphan). El
trabajo correcto ahora **no es agregar features**, sino cerrar la brecha de **adjudicación de
trazabilidad** y **wiring del golden slice**.

## Lo que ES (verificado real)

- **238 packages, 0 vacíos.** El kernel de dominio está implementado de verdad.
- **Golden slice a nivel dominio/datos** (probado EN VIVO contra Neon esta sesión): clinical
  events + aggregate versioning, obligations, result lifecycle, **RLS cross-tenant + fail-closed**,
  **concurrencia optimista + idempotencia + outbox + audit-chain**, **crash recovery atómico**,
  truth/epistemic model, state machines formales.
- **208 capabilities** (`capabilities/catalog.json`), **201 C5 / 7 C4** — casi todo criticidad
  máxima, con registros de invariantes/hazards/controles/tests y `releasePolicy: FAIL_CLOSED`.
- **146 test sources** (Vitest 174/174), gates de admisión (`release:check` verde en CI),
  `validate-registry` (C4/C5 sin test = fail; IA sin kill-switch = fail; SM formales obligatorias).

## Lo que NO ES (brechas honestas)

1. **Trazabilidad mayormente SIN adjudicar.** De **176 PROD**, solo **61** tienen mapeo ENG
   aprobado; **115 en `REVIEW_REQUIRED`/BLOCKED**. ENG→EXEC: **202** en revisión manual.
   `Mapping_Adjudication` está **vacío** (0 adjudicaciones). El registro es explícito:
   *"candidate scores are evidence, not authority"*. → **Es la deuda de gobierno #1**: la
   cadena PROD↔ENG↔EXEC es candidata (machine-assisted), no autoridad humana todavía.
2. **Capa app/API = stubs deny-by-default.** 18 handlers responden 501/503 (`NOT_WIRED`,
   `AUTH_ADAPTER_REQUIRED`) sin parsear body. No hay flujo clínico end-to-end por HTTP: el
   wiring de auth/sesión/persistencia está release-blocked (correcto, pero es un stub).
3. **Amplitud de V2 sin construir.** La mayoría de las 176 capacidades de producto (workflow
   de encuentro, medicación, Prescription Studio, documentos, imagen, AI copilot, portal,
   agenda…) no están implementadas — correctamente deny-by-default, no fingidas.
4. **Defectos latentes que solo la ejecución destapa.** La conformidad **estática** pasaba,
   pero correr la evidencia física reveló **4 defectos reales** (ya reparados esta sesión):
   `pgcrypto` no habilitado (audit-chain rota en BD nueva), circuit-breaker `0` falsy, columna
   `idempotency_key`↔`key`, y un test que violaba la SM formal del encuentro. → Los gates
   estáticos son fuertes pero **no sustituyen la ejecución** (el propio scaffold lo reconoce
   con el hito "physical runtime evidence" v21).

## Consistencia con los 3 documentos

- **Sin contradicciones.** El scaffold implementa las leyes EXEC-0003 (no orphan, no silent AI,
  no frontend authz, no destructive signed-edit, no PHI en telemetría, owner+estado terminal),
  la jerarquía de autoridad (AGENTS.md: PROD→ENG→EXEC→registro→código) y fail-closed.
- El hallazgo previo **S1-1 (PRODUCT-GAP)** queda **subsumido**: como TODA la cadena de mapeo
  está en estado candidato/REVIEW_REQUIRED, la promoción de los primitivos PROD-114…177 es
  parte de esa adjudicación pendiente, no una contradicción activa.
- **S1-2 (registro faltante)** ya está **RESUELTO** (el registro existe; el 4.º documento).

## Recomendación — qué significa "construir" a partir de aquí

En orden, y **capability-by-capability** con el DoD del propio scaffold
(mapping + invariante + test + evidencia):

1. **Adjudicar la trazabilidad del golden slice.** Convertir `REVIEW_REQUIRED → APPROVED` (con
   evidencia) los PROD/ENG del slice ya probado (identidad, eventos, obligations, results, RLS,
   concurrencia, audit). Yo puedo **preparar la evidencia**; la **autoridad final es humana**
   (revisión C5). Esto llena `Mapping_Adjudication` y desbloquea `RG-001`.
2. **Wire del golden slice app/API** (auth/sesión/principal verificado + persistencia sobre el
   kernel ya probado) → los stubs deny-by-default pasan a endpoints reales protegidos por RLS
   → **desbloquea** HTTP fuzzing real, E2E, y construir el resto de capacidades sobre base probada.
3. **Iterar** capacidad por capacidad (medicación, órdenes/resultados, notas/firma, documentos…),
   cada una con su mapping adjudicado, invariantes, tests y evidencia de runtime.

> Resumen: el scaffold es una **base senior y honesta**, no un EHR terminado. Su mayor valor —
> el rigor governance-first — es también su siguiente tarea: **adjudicar el registro** y
> **conectar el golden slice** antes de expandir features.
