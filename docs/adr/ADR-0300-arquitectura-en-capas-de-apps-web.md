# ADR-0300 — Arquitectura en capas de `apps/web`: persistencia partida, kit de transporte, pipeline de comandos, rutas delgadas y guardas de arquitectura
Status: ACEPTADO por ingeniería (2026-09-27) — refactor arquitectónico, lote 11. Estructural y **sin cambio de comportamiento**:
cada lote se acepta solo con sus oráculos idénticos. Los defectos que el análisis encontró están en
[`docs/reviews/2026-09-27-hallazgos-verificados-lote-11.md`](../reviews/2026-09-27-hallazgos-verificados-lote-11.md) y no se
corrigen dentro de este refactor. Revisado de forma adversarial (gobierno, completitud y clasificación de los 27 módulos de
escritura) antes de implementar el lote 2.

## Contexto

El monolito modular (ADR-0030) tiene un dominio sano —49 paquetes de dominio puros, 0 ciclos entre paquetes, ningún paquete
importa `apps/`— pero la aplicación web que lo expone creció por acumulación de lotes de auditoría:

- **Borde HTTP sin capa común.** El *wrapper* común de rutas quedó declarado pendiente en el lote 10f (S-10). De 161
  `route.ts`, 116 delegan en un `handle*` y 43 llevan el pipeline HTTP en línea (registros con KPI, 15 calculadoras, vistas
  compuestas, reportes, receta). El bloque `catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}`
  estaba copiado ~210 veces y la comprobación de `Idempotency-Key` 52.
- **Protocolo de comando copiado por handler.** En los 27 `*-lifecycle.ts` cableados, `loadForTransition` (26 copias) y
  `commit` (24 copias) repiten sesión → autorización → cabeceras → fold → 404 → cuerpo → sobre determinista → replay →
  máquina de estados → kernel → respuesta, con 83 conversiones `result.response as{…}`. Las variantes ya divergieron (D7).
- **Un módulo «dios» de persistencia.** `clinical-runtime.ts`: 957 líneas, 8 responsabilidades, 84 importadores, el
  preámbulo RLS copiado 41 veces y un ciclo de importación con `rate-limit-shared`.
- **Reglas de arquitectura sin guarda.** La única (`architecture-boundary`) compara una cadena literal; 114 scripts —entre
  ellos las 97 pruebas en vivo, que importan 405 módulos de ruta por su ruta de archivo— estaban fuera de todo `tsc`.

## Decisión

### Capas y dirección de dependencias

```
app/api/v1/**/route.ts        Transporte Next: configuración de segmento literal, primer comentario (resumen OpenAPI) y
        │                     delegación `return handleX(req,…)` en un caso de uso
lib/*-lifecycle.ts            Casos de uso de ESCRITURA por agregado (handle*, esquemas zod del cuerpo)
lib/queries/*.ts              Casos de uso de LECTURA que antes vivían en la ruta (subcarpeta: fuera del registro OpenAPI)
        │            ╲
lib/command/*        lib/http/*          Pipeline de comandos (crear / transicionar) · kit de transporte (endpoint, errores)
lib/presenters/*                         Presentadores PUROS (filas → DTO de respuesta), con pruebas unitarias
        │
lib/runtime/*                 Persistencia: pool + rol RLS, transacción de tenant, kernel, event store, read models SQL
        │
packages/*                    Dominio puro (folds, calculadoras, barreras de prescripción) y kernel transaccional
```

Reglas, verificadas por `tests/architecture/boundaries.test.ts` (fuera del manifiesto de evidencia):

1. `packages/*` no importa `apps/`, `scripts/` ni `tests/`; sin ciclos entre paquetes.
2. Los 49 paquetes de dominio solo importan `runtime-errors` y otros paquetes de dominio; sin `node:`, `process.env`,
   `Date.now()`, `Math.random()` ni `new Date()` sin argumentos.
3. `lib/runtime/**` no importa casos de uso, `lib/http`, `lib/command`, `lib/queries`, `lib/presenters`, `next/*` ni la
   fachada `clinical-runtime.ts`. Sin ciclos de archivo en `apps/web/lib`.
4. El cierre de importaciones del middleware (Edge) no alcanza `node:`, `postgres` ni la persistencia.
5. Trinquete de rutas delgadas: el número de `route.ts` con `authorize(` o `toHttpError` solo puede bajar (43 → 0).

### Piezas

- **`lib/runtime/`** (lote 11.1, hecho). `db.ts` (pool perezoso, endpoint directo, rol `medical_os_runtime` y
  `withTenantTx(ctx,fn)`: la única copia del preámbulo RLS), `secrets.ts`, `command.ts`, `event-store.ts`, `pagination.ts`,
  `sql.ts` y `read-models/<dominio>.ts` (13 módulos). `clinical-runtime.ts` es una **fachada con re-exportaciones explícitas**
  de los mismos 79 símbolos (no `export *`, para no filtrar internos).
- **`lib/http/endpoint.ts`** — `endpoint(req,guard,fn)` y `errorResponse(e)` (la única copia de `toHttpError →
  NextResponse.json`). Construye la autorización con `{...guard,tenantId:claims.tenantId}` (la guarda no puede sustituir el
  tenant de la sesión) y hace `return await fn(…)` dentro del `try`.
- **`lib/command/aggregate-command.ts`** — `createCommand` y `transitionCommand`, con estos ajustes para reproducir
  exactamente los handlers de hoy (T1–T10 de la revisión):
  - la guarda es **por operación**, no por agregado (medicación, documento, órdenes: rol o scope distinto por acción);
  - el chequeo de paciente registrado lo hace el propio caso de uso **justo después** de su `parseJson(req,XBody)` literal
    (en todos los *create* va antes de cualquier validación de dominio);
  - `stateField` (`state` | `status`: paciente y encuentro), `check` para anotaciones (sustituye la máquina de estados),
    `strictVersion` (`CONCURRENCY_CONFLICT {expected,actual}` antes del chequeo), `guard` asíncrono en el camino sin replay
    (cédula, barreras de seguridad), `tail` (claves tras `replayed`) y `afterRun` (comandos derivados), y `loadAggregate`
    para los handlers que solo comparten el preludio;
  - la respuesta es `{[idField]:id,[stateField]:to,...extra,version,auditHash,replayed,...tail}` con 201 / 200; el orden de
    claves es parte del contrato;
  - `createCommand` no consulta el replay (el kernel deduplica y el límite de tasa se cobra igual que hoy);
    `transitionCommand` consulta el replay **antes** de la máquina de estados; ninguno normaliza el `payload` (el hash del
    kernel serializa las claves `undefined`).
- **`lib/queries/*` y `lib/presenters/*`** (lote 11.3). Reglas: la ruta conserva su primer comentario `//` como primera línea
  de comentario (resumen OpenAPI) y `return handleX(` en la línea del método; las rutas de escritura que hoy parsean el cuerpo
  en línea (`POST /encounters`, `/interactions`, `/prescription-check`) conservan su parseo y sus mensajes; las rutas siguen
  importando directamente sus `*-lifecycle` (guarda de módulos sin cablear); las semánticas clínicas en SPEC_CONFLICT se mueven
  **literalmente**, sin deduplicar (edad con fechas inválidas, números con coma, conjuntos CIE-10, crisis hipertensiva).
- **`tsconfig.scripts.json` + `pnpm typecheck:scripts`** (lote 11.0, hecho) y el arnés único de las pruebas en vivo en
  `scripts/v22/_live-env.mts` (P-08, lote 11.4).

### Migración por módulo (clasificación de los 27 módulos de escritura cableados)

| Grupo | Módulos | Destino |
|---|---|---|
| Uniformes (82 handlers: 64 transiciones, 18 creaciones) | admission, allergy, careplan, claim, consent, dialysis, immunization, incident, obligation, order, referral, regulatory-obligation, specimen, surgery, transfusion, triage, vital, wound | `createCommand` / `transitionCommand` (alergia en 11.2a, el resto en 11.2b) |
| Con variantes (24 handlers) | problem, appointment, patient (`status`), medication (guardas por operación, anotaciones, barreras, derivados) | 22 al pipeline con T1–T10 (`extra`, `tail`, `check`, `strictVersion`, `guard`, `afterRun`). `handlePatientRegister` y `handlePatientList` quedan en `endpoint()`: el alta consulta el replay ANTES del 409 de duplicado y `createCommand` no consulta el replay |
| Preludio, y pipeline donde el ajuste es exacto (22 handlers) | document, encounter, result, office-settings, physician-profile | 7 al pipeline (documento: crear, finalizar, firmar, enmendar; resultado: verificar, actuar, cerrar). 15 en `endpoint()` con el cuerpo escrito a mano: adjuntos multipart, descargas y lecturas, encuentro (lee con `readEncounterEvents`), recepción y corrección de resultados (valores del servidor; la corrección con `loadAggregate`), ajustes del consultorio y perfil del médico |
| Sin cablear (8, registro NOT_WIRED) | adaptive-history, ai-gateway, clinical-inbox, clinical-intelligence, document-ingestion, imaging, lab-order, prescription | No se tocan (decisión del dueño) |

### Oráculos (un lote se acepta solo si todos son idénticos)

| Contrato | Oráculo |
|---|---|
| SQL de cada read model, límites de transacción y rol RLS del pool | `tests/architecture/runtime-sql-contract.test.ts` (texto, parámetros, BEGIN/COMMIT, consultas dentro o fuera de la transacción, resultado mapeado, opciones del pool) |
| Contrato HTTP de las 177 operaciones sin base de datos: precedencia 401/403 → 428 → 404 → 400 → replay → 409, cuerpos y el comando exacto que llega al kernel | `tests/architecture/http-contract.test.ts` (persistencia sustituida por dobles), tomado antes del lote 11.2 |
| Respuestas contra PostgreSQL real | Todas las pruebas en vivo (97 al aceptar este ADR; cada defecto corregido añade la suya): `SMOKE: N PASS · 0 FAIL · 0 SKIP` (una corrida sin base de datos, o sin `BLOB_READ_WRITE_TOKEN` para las de adjuntos, NO cuenta) y las etiquetas `checks` de cada prueba existente idénticas antes y después |
| Ids derivados y hash de idempotencia | Sin cambios en el kernel ni en `derivedUuid`; el oráculo HTTP registra el comando completo |
| `docs/api/openapi.json`, `api-body-registry.ts` | `pnpm openapi:check` sobre un árbol limpio (el `--check` reescribe `lib/*.ts` antes de fallar: `git status` debe quedar limpio) |
| Manifiesto de evidencia, capacidades, invariantes y registros de adjudicación | Ningún test fijado ni registro se edita; `release`, `capability` y `traceability` con salida idéntica |
| Build | `pnpm build:web` por lote; `/workspace` ≤ 185 kB de *first load* |

El estilo compacto del código se conserva: el refactor cambia estructura, no formato. Los codemods copian el texto original.

### Lotes

| Lote | Contenido | Estado |
|---|---|---|
| 11.0 | Red de seguridad: oráculo SQL, guardas de arquitectura, `typecheck:scripts`, `zod` a dependencias | Hecho |
| 11.1 | Persistencia partida en `lib/runtime/`, fachada, `withTenantTx`, ciclo roto | Hecho |
| 11.1b | Oráculos reforzados: SQL con límites de transacción (re-verificado contra la línea base anterior a la partición), contrato HTTP de las 177 operaciones, guarda cliente/servidor y trinquete de `process.env` | Hecho |
| 11.2a | Kit de transporte (`endpoint()` / `errorResponse()`), pipeline de comandos y alergia como migración de referencia | Hecho |
| 11.2b | Los 26 módulos cableados restantes: 107 handlers al pipeline (21 creaciones, 86 transiciones) y 17 en `endpoint()` | Hecho |
| 11.3 | Rutas delgadas: `lib/queries` + `lib/presenters` con pruebas unitarias | — |
| 11.4 | Arnés único de las pruebas en vivo (P-08) | — |

## Descartado en este refactor

- **Plantilla común de folds (`packages/aggregate-fold`).** Los 24 folds son las máquinas de estado ejecutables de
  capacidades C4/C5 con mensajes y matices propios (etiquetas, génesis, `status`); ahorrar ~300 líneas no justifica el riesgo.
  Si se retoma, con su propio ADR, oráculo exhaustivo de transiciones y firma del responsable clínico.
- **Alias `@medos/*`.** Las guardas resuelven importaciones relativas: con alias pasarían en vacío, y los cuatro resolutores
  (tsc raíz *bundler*, tsc web *node*, Next y tsx) no coinciden. ADR propio, después de enseñar el alias al grafo.
- **Cockpit (`model.tsx`, 1 404 líneas; cliente API tipado; contratos isomórficos).** ADR propio, sucesor de K-09: toca
  pruebas de UI que simulan `session-client` por ruta y marcadores leídos por regex.
- **Retiro de paquetes heredados (K-01/K-07)** y cualquier cambio del manifiesto, del catálogo o de los predicados de
  invariantes: re-línea base de evidencia (G-03), decisión del dueño.

## Consecuencias

- Un cambio transversal del protocolo (validación de parámetros de ruta, clasificación de errores de almacén, id de
  correlación, límite de tasa por petición, la comprobación de versión de D7) se hace en un sitio, no en ~110 handlers.
- Las rutas quedan como adaptadores y la lógica de lectura y presentación se prueba sin base de datos.
- **Deuda de trazabilidad declarada:** el registro de reconciliación cita `apps/web/lib/clinical-runtime.ts` (48 veces) y
  rutas cuya lógica se mueve; las citas siguen resolviendo (la prueba de integridad solo comprueba existencia) pero apuntan a
  fachadas. Re-apuntarlas es una edición del registro aprobado: requiere al dueño. Correspondencia fachada → módulo:
  `getSql` → `runtime/db`; `sessionSecret` → `runtime/secrets`; `runClinicalCommand`, `lookupReplay` → `runtime/command`;
  `read*Events`, `readEventPayloadById`, `readEncounter` → `runtime/event-store`; paginación → `runtime/pagination`; el resto
  → `runtime/read-models/<dominio>`.
