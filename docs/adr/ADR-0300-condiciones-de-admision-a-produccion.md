# ADR-0300 — Condiciones de admisión a producción clínica: una sola lista, con su estado
Status: ACEPTADO (2026-09-24) — auditoría 2026-09-19, anexo R09 (R09-005)

## Contexto

Tres ADR de iteraciones distintas —ADR-0130 (v13), ADR-0150 (v15) y ADR-0160 (v16)— declaran, cada uno con sus propias
palabras, que **la producción está bloqueada hasta** que se cumplan ciertas condiciones. El anexo R09-005 lo señaló como
patrón: la frase se repite de una versión a la siguiente «sin que X se resuelva». El problema real no es la frase, es que
ninguna de las tres dice *dónde* se comprueba su condición ni *quién* la levanta, así que no hay forma de saber si el
bloqueo sigue vigente. Un bloqueo que nadie puede evaluar no protege: se convierte en decoración y termina ignorado.

Además, las tres listas se solapan parcialmente y ninguna es la autoridad, que es la misma enfermedad que la auditoría
encontró en el esquema (dos definiciones de la misma tabla) y en los paquetes duplicados.

## Decisión

1. **Esta es la única lista de condiciones de admisión a producción clínica.** ADR-0130, ADR-0150 y ADR-0160 conservan su
   texto histórico —un ADR no se reescribe— pero remiten aquí, y ninguna otra fuente declara condiciones nuevas.
2. **Cada condición dice cómo se comprueba y quién la levanta.** Una condición sin verificación es una intención; una
   condición cuya verificación es un documento que alguien tiene que leer es una intención con más pasos.
3. **Las condiciones de INGENIERÍA se comprueban en cada commit.** No se declaran cumplidas: se ejecutan.
4. **Las condiciones de DECISIÓN son del dueño.** La ingeniería no puede cerrarlas ni declararlas cerradas, y decirlo
   explícitamente es parte de no presentar una falla abierta como seguridad.

### Condiciones de ingeniería (verificadas por ejecución)

| Condición | Origen | Cómo se comprueba hoy | Estado |
| --- | --- | --- | --- |
| Pruebas respaldadas por dependencias reales, no dobles | ADR-0130, ADR-0150, ADR-0160 | `scripts/ci/live-smoke.mts` descubre y ejecuta las pruebas `live-*-proof.mts` contra una base desechable; hoy 107 | CUMPLIDA |
| PostgreSQL vivo con RLS ejercitada, no asumida | ADR-0130, ADR-0150, ADR-0160 | `live-rls-every-table-proof.mts` recorre las tablas con RLS e intenta leer con otro tenant bajo un rol sin BYPASSRLS | CUMPLIDA |
| Aislamiento por tenant bajo condiciones hostiles | ADR-0130 | El mismo, más `live-concurrency-and-audit-vector-proof.mts` (carreras reales con `Promise.all`) | CUMPLIDA |
| Autoridad de escritura atómica y divergencia de replay | ADR-0150 | `live-dr-recovery-proof.mts` y el drill de restauración, con el replay derivado del constructor del comando | CUMPLIDA |
| Verificación de recuperación (restore/DR) | ADR-0150 | `live-restore-drill-proof.mts` ejecuta el drill real contra dos bases desechables y exige `db:check` sobre la restaurada | CUMPLIDA |
| Verdad firmada y de solo-añadir | ADR-0150 | La cadena `audit_chain_v3` reproducida FUERA de Postgres en `live-concurrency-and-audit-vector-proof.mts` | CUMPLIDA |
| Admisión de release fail-closed | ADR-0130 | `pnpm release:check` + `pnpm capability:check` + `pnpm traceability:check`, los tres en cada commit | CUMPLIDA |
| Evidencia ligada criptográficamente | ADR-0150, ADR-0160 | `release/test-evidence-manifest.json` con sha256 por prueba, validado por RG-013 | CUMPLIDA |
| Migraciones versionadas y sin deriva | ADR-0160 | `pnpm db:migrate` como único mecanismo + `pnpm db:check` (deriva por sha256 contra el repo) | CUMPLIDA |
| Evaluación de defectos | ADR-0150, ADR-0160 | La auditoría del 19-sep-2026 y su remediación trazada en `docs/reviews/2026-09-20-remediacion-auditoria.md` | EN CURSO |

### Condiciones de decisión (del dueño; la ingeniería no puede levantarlas)

| Condición | Origen | Qué falta exactamente | Dónde está anotada |
| --- | --- | --- | --- |
| Revisión humana de seguridad C5 | ADR-0150, ADR-0160 | Un revisor C5 que acepte las capacidades con su evidencia | `docs/adjudication/README.md` (propuesta con evidencia, 16 capacidades); auditoría G-03/P-09 |
| Adjudicación de mapeos (aceptación humana) | ADR-0150 | Aceptar o rechazar los mapeos PROD→ENG en `REVIEW_REQUIRED`; el registro del spec llegó vacío | R09-023; `docs/adjudication/golden-slice-adjudication.json` |
| Revisión de gobierno independiente | ADR-0160 | Un revisor que no sea el autor de las revisiones | R09-015 |
| Determinación regulatoria (alcance y clasificación) | — | Si el sistema es dispositivo médico bajo NOM-241/ScDM, y el sistema de gestión de calidad que implique | R09-006; `docs/compliance/nom-applicability-register.json` |
| Retención y borrado de PHI (ARCO) | — | Plazo legal, criptoborrado vs purga, menores y fallecidos, procedimiento ARCO | ADR-0280 §Decisiones pendientes; R06-30 |
| Validación clínica del contenido | — | Un especialista que valide rangos, umbrales y algoritmos clínicos | Auditoría (validación clínica de todo el contenido); el cotejo contra las guías internacionales ya está hecho y deja **diez decisiones numeradas (D1–D10)** en `docs/compliance/cotejo-de-guias-clinicas.md` |
| D1 — Guía de fibrilación auricular | Cotejo de guías, §6 | Elegir entre **ESC 2024 (CHA₂DS₂-VA, sin punto por sexo)** y **ACC/AHA 2023 (CHA₂DS₂-VASc)**: dos guías vigentes discrepan y el sistema implementa la americana | `packages/stroke-risk`; cotejo §6 |
| D2 — Estadificación de ERC por G + albuminuria | Cotejo de guías, §1 | KDIGO estadifica por causa, filtración **y albuminuria**; el sistema solo usa filtración. Un eGFR 95 con UACR 400 mg/g se presenta hoy como función renal normal | `packages/renal-function`; los cortes de UACR ya están en `packages/lab-reference` |
| D3 — Brecha aniónica corregida por albúmina | Cotejo de guías, §4 | Con hipoalbuminemia la brecha «normal» enmascara una acidosis de brecha alta. La corrección está en la fuente que el módulo ya cita | `packages/acid-base` |
| D4 — Valores de pánico del laboratorio real | Cotejo de guías, §valores de pánico | Los 28 analitos usan umbrales «de demostración». Los valores críticos los define cada laboratorio y gobiernan el lazo de resultado crítico, el bloqueo de firma y las obligaciones urgentes | `packages/lab-reference` |
| D5–D10 — Resto del cotejo | Cotejo de guías | Guía de presión arterial (ACC/AHA vs ESC), CURB-65 como cribado o PSI/PORT, pesos de Charlson, eGFR pediátrico U25, MELD 3.0, nomenclatura MASLD | `docs/compliance/cotejo-de-guias-clinicas.md` |
| Plazos de seguimiento (techos operativos) | R05a-F04 | Confirmar o cambiar las 72 h de prioridad ALTA (decisión operativa, sin norma citada) y decidir si el seguimiento de un **vital crítico** debe heredar el techo urgente de 24 h: hoy nace como rutina (`kind:"CRITICAL_VITAL_FOLLOWUP"`, sin tipo declarado), y declararlo urgente cambiaría el gate de firma para los vitales registrados con más de 24 h de retraso | `packages/obligation-domain/src/index.ts` (`PRIORITY_DUE_WINDOWS`, `OBLIGATION_DUE_WINDOWS`) |

## Alternativas consideradas

1. **Dejar las condiciones repartidas entre ADR-0130, ADR-0150 y ADR-0160.** Era el estado de partida y se descartó
   porque tres listas parciales no son una lista: nadie podía responder «¿qué falta para producción?» sin leer tres
   documentos y reconciliarlos a mano.
2. **Reescribir esos tres ADR para unificarlos.** Se descartó porque **un ADR no se reescribe**: su valor es registrar lo
   que se decidió cuando se decidió. Conservan su texto y remiten aquí.
3. **Condiciones verificadas por revisión documental.** Se descartó con el criterio que este ADR declara: «una condición
   cuya verificación es un documento que alguien tiene que leer es una intención con más pasos». Las condiciones de
   ingeniería se ejecutan en cada commit; las de decisión son del dueño y la ingeniería **no puede** declararlas cerradas.

## Consecuencias

- **La producción clínica sigue bloqueada**, y ahora se puede decir por qué en una frase: las condiciones de ingeniería se
  cumplen y se vuelven a comprobar en cada commit; las de decisión están abiertas y son del dueño.
- Una condición de ingeniería nueva no se declara en prosa: entra como gate o como prueba en vivo, o no cuenta.
- `tests/v22/adr-integrity.test.ts` impide que un ADR vuelva a declarar un bloqueo sin remitir a esta lista, y que esta
  lista cite una verificación que no existe en el repositorio.
