# Epic C — Restore/DR Drill + Performance Benchmark (15-sep-2026)

Cierra la evidencia física pendiente del scaffold (`restore_drill: NOT_RUN`,
`performance: NOT_RUN` en `registry_meta_v22_0.json`) sobre el vertical ya cableado (Epic B).

## 1. Performance benchmark (ejecutado, contra Neon en vivo)

`scripts/v22/perf-benchmark.mts` mide el endpoint real (`POST` abrir + `GET` leer) y evalúa con
el gate real `performanceGate`. Método: warmup excluido; 60 escrituras seriales (latencia),
60 lecturas seriales, ráfaga de 40 con concurrencia 10 (throughput). Conexión: endpoint
directo de Neon, rol `medical_os_runtime`, prepared statements.

**Resultado ejecutado (15-sep-2026, contra Neon):** `status: PASS`.

| Métrica (POST open) | Valor | Presupuesto | Veredicto |
| --- | --- | --- | --- |
| p50 | 650 ms | — | — |
| p95 | 737 ms | ≤ 2000 ms | ✅ |
| p99 | 744 ms | ≤ 4000 ms | ✅ |
| errorRate | 0 % | ≤ 2 % | ✅ |
| throughput | 3.5 ops/s | (no gateado) | observado |

Lectura RLS-scoped (GET): p50 400 ms, p95 465 ms. Muestras: 60 writes + 60 reads + 40 burst,
**0 errores**. Nota: habilitar prepared statements (endpoint directo, sin pooler) redujo la
latencia ~2× respecto a la primera corrida (p50 1425→650 ms, p95 1694→737 ms).

**Lectura honesta:** el presupuesto de **latencia** y **tasa de error** es la señal de salud
del código; el **throughput** de un único proceso local contra un Neon remoto **no** es una
capacidad de producción (dominado por RTT laptop→Neon × los ~8 round-trips secuenciales que el
comando atómico hace *a propósito* por correctness). El valor del benchmark aquí es doble:
(a) baseline real con **0 errores** bajo carga, y (b) un **gate de regresión que funciona**
(detecta correctamente cuando una métrica sale del presupuesto). No se ajustó el presupuesto
para forzar un PASS.

## 2. Restore / DR drill (listo; requiere Neon desechable)

`scripts/v22/restore-drill.mts` reconstruye el esquema completo en una **BD desechable** (un
branch de Neon) y verifica una `RestoreProof` con el gate real `restoreErrors()`:

| Check | Qué prueba |
| --- | --- |
| `schemaHash == expectedSchemaHash` | El esquema restaurado (public+app) es idéntico al vivo |
| `auditValid` | Cadena de auditoría encadenada (previous_hash del 2.º == entry_hash del 1.º) |
| `rlsPass` | Otro tenant no ve los eventos sembrados (RLS forzado) |
| `replayHash == liveHash` (`obligationsMatch`) | Persistencia **determinista**: el stream de eventos reconstruido coincide con la proyección esperada derivada de las definiciones puras |

**Salvaguarda:** exige `RESTORE_DATABASE_URL` y **rehúsa** correr si apunta al mismo host+db
que `DATABASE_URL` (el drill aplica DDL y escribe: nunca contra la BD activa). Sin target
responde `NOT_RUN` (verificado). Aplica `db/roles_v16.sql` + `db/migrations/0001..0017` en
orden y ejercita el kernel real bajo el rol runtime.

**Estado: NOT_RUN — pendiente de un branch de Neon desechable.** Para ejecutarlo:

```bash
# 1) crear un branch desechable en Neon (dashboard o neon CLI) y copiar su connection string
RESTORE_DATABASE_URL='postgres://...branch...' pnpm exec tsx ./scripts/v22/restore-drill.mts
```

No se fabrica un resultado: el drill produce evidencia real solo contra una BD real desechable.

## Resumen

- Performance: **ejecutado** (baseline real, 0 errores; ver resultado arriba y el gate).
- Restore/DR: **script listo y auto-protegido**, `NOT_RUN` hasta disponer de un branch de Neon.
- El resto de verticales heredan ambos arneses sin cambios.
