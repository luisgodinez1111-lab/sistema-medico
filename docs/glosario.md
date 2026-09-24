# Glosario

> Autoridad: auditoría 2026-09-19, anexo R09 (R09-032). Cada término dice **dónde vive en el código**, para que el
> glosario no pueda convertirse en una lista de definiciones bonitas desconectada de la implementación.

## Núcleo event-sourced

| Término | Qué es | Dónde vive |
| --- | --- | --- |
| **Evento clínico** | El hecho registrado. Inmutable y de solo-añadir: nunca se edita ni se borra. Un error se corrige con un evento nuevo que anota encima | tabla `clinical_events`; ADR-0240 |
| **Agregado** | La secuencia de eventos de una misma cosa (un paciente, un encuentro, una medicación), identificada por `(tenant_id, aggregate_id, sequence)` | `clinical_events` |
| **`kind`** | El discriminador del payload. Un `kind` desconocido es `INVARIANT_VIOLATION`, no un evento que se ignora | `apps/web/lib/payload-schemas.ts` |
| **Fold** | La función pura que deriva el estado actual plegando los eventos del agregado. El estado **nunca** se guarda como verdad: se recalcula | `packages/*-fold`, `packages/*-lifecycle` |
| **Evento de anotación** | Enriquece sin cambiar el estado (`MODIFIED`, `RECONCILED`, `EPISTEMIC_CHANGED`). Los folds los toleran solo si están declarados | ADR-0240 §2 |
| **Concurrencia optimista** | Dos escrituras sobre el mismo agregado con la misma versión esperada: una gana, la otra recibe 409 | tabla `aggregate_versions` |
| **Idempotencia** | Reintentar el mismo comando no duplica el evento. La clave la reclama el kernel antes de escribir | `command_idempotency`; `pnpm idempotency:purge` |
| **Outbox** | Cola transaccional: el evento y su mensaje se escriben en la MISMA transacción. **El consumidor no está construido** (D-03, decisión del dueño) | tabla `outbox`; ADR-0031 |
| **Cadena de auditoría** | Cada entrada encadena por hash con la anterior (`previous_hash` = `entry_hash` de la previa; la primera, `GENESIS`) | `audit_chain_v3`, `app.append_audit_v17` |

## Aislamiento y acceso

| Término | Qué es | Dónde vive |
| --- | --- | --- |
| **Tenant** | La unidad de confianza: un consultorio o clínica pequeña. Todo clínico del tenant con el scope correcto ve a todos sus pacientes | ADR-0230 §2 |
| **RLS forzada** | Row Level Security habilitada **y forzada**, de modo que ni el dueño de la tabla la esquiva. El rol de la aplicación no tiene `BYPASSRLS` | migración 0020; `scripts/v22/live-rls-every-table-proof.mts` |
| **Scope** | El permiso obligatorio de cada operación (`<recurso>:read` / `:write`). Sin scope, `authorize()` falla cerrado | `packages/runtime-auth` |
| **Propósito** | Para qué se accede (`TREATMENT`, etc.). Viaja en el contexto y se registra en cada lectura de PHI | `packages/http-principal`; `phi_access_log` |
| **PHI** | Información de salud protegida. Se registra **quién la leyó y para qué**, nunca el contenido leído | migración 0024 |
| **BOLA** | Que un clínico del mismo tenant lea un expediente que no le corresponde. **No se previene: se detecta** | `docs/threat-models/baseline-threat-model.md` |
| **Break-glass** | Acceso de emergencia fuera del flujo normal. **No está construido**: no hay hoy un camino auditado | retirado en el lote 10w; tablas retiradas en 0028 |

## Seguridad clínica

| Término | Qué es | Dónde vive |
| --- | --- | --- |
| **Barrera** | Un bloqueo de prescripción (alergia, interacción, dosis, embarazo). Anularla exige **nombrarla y justificarla** | `packages/medication-validation`; ADR-0270 |
| **Techo de dosis** | Máximo diario no anulable, y máximo pediátrico por mg/kg. Se toma el más restrictivo | `packages/medication-validation` |
| **`NOT_EVALUATED`** | Que la evaluación de seguridad no se pudo hacer. **Nunca equivale a `CLEAR`**: es la diferencia entre "no hay riesgo" y "no sé" | INV-CORE-0009 |
| **Obligación clínica** | Un seguimiento con dueño y fecha límite. Una obligación crítica sin resolver **bloquea la firma** del encuentro | `apps/web/lib/obligation-lifecycle.ts` |
| **Zero Lost Follow-Up** | Que ningún resultado crítico se quede sin acción: se crea la obligación y el gate de firma la exige | HAZ-CORE-0001/0002, CTL-0001/0002 |
| **Clase epistémica** | Qué tan cierto es un dato: `FACT`, `DERIVED`, `INFERENCE`, `RECOMMENDATION`, `UNKNOWN`, `CONFLICTING`. Un `UNKNOWN` no se pinta como normal | `docs/design-contract/contracts/component-anatomy.ts` |
| **Recibo de cálculo** | Algoritmo, versión, autoridad clínica y **hash de las entradas** de cada cálculo: lo que permite reproducirlo y auditarlo | `apps/web/lib/calc-receipt.ts` |
| **Ficha de algoritmo** | Fórmula, unidades, umbrales, fuente primaria y **lo que el algoritmo NO hace** | `docs/compliance/inventario-de-algoritmos.md` (generado) |
| **Corrección de resultado** | Un resultado corregido no se edita: nace uno nuevo con `supersedes` y el original queda anotado. El linaje no puede tener ciclos | `packages/result-correction` (INV-CORE-0007) |
| **Anulado (`ENTERED_IN_ERROR`)** | Un registro anulado desaparece del registro clínico **para siempre**: una anotación posterior no lo resucita | `apps/web/lib/runtime/registries.ts` |

## Gobierno y evidencia

| Término | Qué es | Dónde vive |
| --- | --- | --- |
| **Peligro (HAZ)** | Condición que puede dañar a un paciente, con su secuencia previsible y su daño potencial | `safety/core-hazards.json` |
| **Control (CTL)** | Lo que impide o detecta un peligro. Preventivo, detectivo, correctivo o de recuperación | `safety/controls/catalog.json` |
| **Invariante (INV)** | Lo que siempre debe ser cierto, con su predicado ejecutable | `safety/core-invariants.json` |
| **Capacidad (CAP)** | Una unidad de funcionalidad con su riesgo, peligros, controles, invariantes y pruebas | `capabilities/catalog.json` |
| **Fail-closed** | Ante la duda, bloquear. Ningún código de error mapea a 2xx; sin dependencia se responde 503, nunca "guardado" | `tests/v22/downtime-no-false-save.test.ts` |
| **Prueba en vivo** | Ejercita el comportamiento contra Postgres real con RLS, en una base **desechable** | `scripts/v22/live-*-proof.mts` |
| **Lote de remediación** | La unidad de trabajo de la auditoría: hallazgos + commit + verificación | `docs/reviews/2026-09-20-remediacion-auditoria.md` |
| **Cierre de ingeniería** | Que el defecto está corregido y verificado. **No** implica validación clínica ni determinación regulatoria | ADR-0300 |

## Normas citadas

| Norma | Qué exige aquí | Estado |
| --- | --- | --- |
| **NOM-004-SSA3-2012** | Estructura y control del expediente clínico; conservación **mínima de cinco años** desde el último acto médico (numeral 5.6) | Parcial: la conservación no está implementada (R06-30) |
| **NOM-024-SSA3-2012** | Interoperabilidad e intercambio; CURP como identificador nacional | Parcial: CURP validada; conformidad SIRES sin verificar |
| **LFPDPPP** | Protección de datos personales; derechos ARCO; notificación de vulneraciones | Parcial: falta aviso de privacidad y flujo ARCO (ADR-0280) |
| **NOM-241 / ScDM** | Si el sistema es dispositivo médico | **Pendiente de determinación** del dueño |
| **ISO 14971** | Gestión de riesgo (severidad × probabilidad) | Parcial: falta la probabilidad, que es juicio clínico |
