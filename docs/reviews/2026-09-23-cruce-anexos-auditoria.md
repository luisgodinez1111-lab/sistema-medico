# Cruce de los anexos de la auditoría del 19-sep-2026 contra el código actual

La auditoría dejó dos niveles de hallazgos: los **115 consolidados** del documento principal
(`AUDITORIA_REPO_REAL.md`), cuya remediación se sigue en
[`2026-09-20-remediacion-auditoria.md`](2026-09-20-remediacion-auditoria.md), y los **~307 hallazgos de detalle** de
los 13 anexos (`auditoria_repo_detalle/`), que nunca se rastrearon uno por uno. Este documento es ese rastreo: cada
hallazgo de anexo, verificado contra el código de `e021a60` con su evidencia.

## Reconciliación del estado (2026-09-24, lote 13c)

La columna de estado de este documento se había quedado **atrás respecto al código**: mostraba R03 con cero hallazgos
cerrados cuando R03 se cerró completo en los lotes 11b–11i, y R01 igual con sus veinte. Quince filas de R06 seguían
marcadas ABIERTO o PARCIAL estando cerradas desde los lotes 12a–12d. Es exactamente el defecto que esta auditoría
persigue —un documento que afirma algo distinto de lo que hace el código— y estaba en el propio registro de la
remediación, así que se reconcilió fila por fila.

**Qué significa aquí cada estado, para que el porcentaje no se lea como más de lo que es:**

- **CERRADO (lote N)** — existe un lote de remediación confirmado que atiende el hallazgo, y **todos los artefactos que
  ese lote cita existen hoy en el árbol** (o están registrados como retiros deliberados en
  `docs/adjudication/retired-paths.json`). Es cierre de INGENIERÍA, verificado contra el disco, no copiado del tracker.
- **PARCIAL** — la ingeniería está hecha y lo que falta es una decisión que la ingeniería no puede tomar. En R06 son seis:
  tabla `tenants` y claves foráneas, worker del outbox, retención/ARCO de PHI y exposición del informe de verificación.
- **ABIERTO** — sin lote todavía.

**Salvedad que aplica a TODO el contenido clínico y no se repite fila por fila:** un hallazgo CERRADO significa que el
algoritmo, el rango o la barrera están implementados, medidos y probados con sus fuentes citadas. **No** significa que un
especialista los haya validado, ni que exista la determinación regulatoria de alcance. Esas dos cosas son del dueño y
están en la lista única de condiciones de admisión a producción: **ADR-0300**.

**Lo que este documento NO cubre:** seis de los trece anexos nunca se cruzaron (R02b, R05b, R05c, R07, R08, R11). Suman
114 hallazgos numerados —R05b 30, R05c 33, R11 31, R08 14, R07 6— más los de R02b, que no los numera (son tablas de «qué
falta para subir de nivel» por motor, y habrá que enumerarlos al cruzarlo). Contra el universo completo, el avance es
menor que el que sugiere el total de este documento, y así debe leerse.

## Método

Un verificador por anexo, en **solo lectura** sobre un árbol fijo (`e021a60`, sin tocar base de datos ni producción).
Cada hallazgo se localiza en el código de HOY (los ficheros citados pueden haberse movido: el monolito
`workspace/page.tsx` se partió en `model/shared/context/views`, y 102 paquetes se eliminaron) y se clasifica:

| Status | Significado |
|---|---|
| `RESUELTO` | el defecto concreto ya no existe (con evidencia `fichero:línea` o vector ejecutado) |
| `PARCIAL` | mejoró, pero parte de la afirmación del anexo sigue siendo cierta |
| `ABIERTO` | sigue siendo cierto tal cual |
| `NO_APLICA` | el código citado se eliminó, o el hallazgo no es sobre el repo |
| `NO_VERIFICABLE` | exige base de datos, producción o criterio clínico/regulatorio |
| `FORTALEZA` | el anexo lo listaba como punto fuerte, no como defecto |

Regla de estrictez: ante la duda entre `RESUELTO` y `PARCIAL`, se clasifica `PARCIAL`. Un flujo inseguro detrás de un
flag apagado es `PARCIAL` (contenido), nunca `RESUELTO`.

> **Cobertura de este cruce: 7 de 13 anexos.** Faltan R02b, R05b, R05c, R07, R08, R11
> (IA, inteligencia clínica, ingesta documental y verticales hospitalarias; Cockpit del expediente, tramo 2 (page.tsx L1952–3069); Cockpit del expediente, tramo 3 (L3070–4537), login y demás páginas; Pruebas (unitarias, render, en vivo, gates); Grafo de paquetes, código muerto, design system; Evidencia de release, CI, scripts operativos y despliegue), interrumpidos por límite de uso del modelo. Los datos de esos anexos
> **no** están verificados aquí: lo que el documento principal consolidó de ellos sí está en el tracker de remediación.

## Resultado por anexo

| Anexo | Alcance | Entradas | RESUELTO | PARCIAL | ABIERTO | NO_APLICA | FORTALEZA |
|---|---|---:|---:|---:|---:|---:|---:|
| `R01` | Runtime, autenticación, sesión y aislamiento por tenant | 38 | 9 | 7 | 13 | 2 | 7 |
| `R02a` | Lifecycles clínicos núcleo (encuentro, nota, receta, resultados, problemas, paciente…) | 50 | 7 | 18 | 15 | 0 | 10 |
| `R03` | Exactitud clínica de 34 algoritmos (vectores ejecutados) | 60 | 10 | 25 | 15 | 0 | 10 |
| `R04` | Rutas de la API v1 | 41 | 9 | 6 | 12 | 2 | 12 |
| `R05a` | Cockpit del expediente, tramo 1 (page.tsx L1–1951) | 36 | 6 | 9 | 11 | 0 | 10 |
| `R06` | Base de datos, RLS, migraciones, outbox | 61 | 16 | 27 | 7 | 1 | 10 |
| `R09` | Documentación, ADR, gestión de riesgo y cumplimiento | 48 | 9 | 18 | 11 | 0 | 10 |
| **Total** | | **334** | **66** | **110** | **84** | **5** | **69** |

## Resultado por severidad (la que puso el anexo; sin las fortalezas)

| Severidad | Entradas | RESUELTO | PARCIAL | ABIERTO | NO_APLICA |
|---|---:|---:|---:|---:|---:|
| CRÍTICA | 40 | 15 | 23 | 2 | 0 |
| ALTA | 75 | 25 | 39 | 11 | 0 |
| MEDIA | 49 | 11 | 17 | 21 | 0 |
| BAJA | 33 | 3 | 4 | 26 | 0 |
| SIN_SEVERIDAD | 68 | 12 | 27 | 24 | 5 |
| **Total** | **265** | **66** | **110** | **84** | **5** |

Lectura honesta de estas cifras: la remediación de los 115 consolidados se llevó por delante **el riesgo alto** de los
anexos (de las 40 críticas verificadas, 2 siguen abiertas tal cual), pero dejó **sin tocar la mayor parte de lo
medio y bajo**: código muerto sin retirar, ergonomía del repo, textos de documentos desactualizados y detalles de
robustez. Un `PARCIAL` en una crítica suele significar "el defecto grave se corrigió y queda un residuo declarado"
(p. ej. techos de dosis pediátricos que cubren 6 principios de 38, o cédula profesional validada en formato pero no
contra el registro de la SEP).

## Pendientes por anexo (ABIERTO y PARCIAL)

### `R01` — Runtime, autenticación, sesión y aislamiento por tenant (20 pendientes)

| ID | Sev | Status | Hallazgo | Qué falta / estado actual |
|---|---|---|---|---|
| R01-001 | ALTA | CERRADO (10v) | God-module: clinical-runtime.ts mezcla runtime de comandos con 64 read-models no relacionados | Separar los read-models por dominio (patients/, reports/, etc.) dejando en clinical-runtime.ts solo getSql/sessionSecret/runClinicalCommand/lookupReplay. |
| R01-009 | ALTA | CERRADO (10w) | infra/compose.yaml: el servicio web solo compila (no arranca) y el worker ejecuta un .ts con node sin invocar nada; sin despachador del outbox | El servicio web de compose sigue sin 'next start'/server.js (README lo presenta solo como Postgres opcional); el despacho del outbox sigue sin existir (decisión del dueño pendiente: construir consumidor o retirar el outbox). |
| R01-010 | ALTA | CERRADO (10s) | El único gate anti-bypass de identidad dev depende de NODE_ENV/VERCEL_ENV, que el Dockerfile nunca fijaba | Falta la tercera señal positiva e independiente (p. ej. exigir OIDC_ISSUER/OIDC_AUDIENCE o bloquear el arranque si DEV_IDENTITY_SECRET coexiste con una DATABASE_URL no local); .env.example sigue proponiendo AUTH_MODE=development y DEV_IDENTITY_SECRET por defe… |
| R01-019 | ALTA | CERRADO (10u) | authorize() no puede comprobar relación médico-paciente; chequeo cross-tenant tautológico; role/scope/purpose opcionales | Falta (a): authorize() con identificador de recurso y verificación de relación médico-paciente (ADR-0230 lo deja como deuda hasta el primer tenant grande); el chequeo cross-tenant sigue siendo tautológico. |
| R01-025 | ALTA | CERRADO (10w) | actor_type se grababa siempre como 'HUMAN', incluso para comandos del copiloto de IA; 'authority' recibe {purpose} | Retirar o alinear event-kernel, dar semántica real a 'authority' y añadir un test de integración de atribución AI/SYSTEM. |
| R01-032 | ALTA | CERRADO (10s) | Ausencia total de middleware.ts: ninguna capa intercepta requests para proteger rutas de PÁGINA | Añadir al middleware la redirección a /login cuando falte la cookie medos_session en rutas distintas de /, /login y /api/*. |
| R01-033 | ALTA | CERRADO (10w) | rate-limit y break-glass existen como paquetes sin importadores: sin límite de tasa real ni acceso de emergencia | Decidir break-glass: conectarlo a authorize() con auditoría reforzada o retirar packages/break-glass; retirar packages/rate-limit v1 (solo lo usa un test). |
| R01-002 | MEDIA | CERRADO (10s) | Duplicación por plantilla: la misma línea de set_config repetida en cada read-model | Extraer un helper único withTenantTx(ctx, sql, cb) que haga sql.begin + los 4 set_config y usarlo en los 41 sitios. |
| R01-003 | MEDIA | CERRADO (10u) | clinical-runtime.ts no aplica autorización propia (ni rol ni relación médico-paciente) más allá de tenantId | Sigue sin verificación de recurso (patientId/relación médico-paciente) en authorize() ni en los read-models; ADR-0230 lo registra como deuda explícita. Falta también un test 403 por actor sin relación con el paciente. |
| R01-006 | MEDIA | CERRADO (10s) | Sin evidencia de límite/monitoreo de conexiones directas a Neon bajo concurrencia serverless | Prueba de carga que fije el max seguro por plan de Neon, retry con backoff ante pool agotado y alarma de saturación; o pasar a un modelo pooled RLS-aware (SET ROLE por transacción). |
| R01-013 | MEDIA | CERRADO (10s) | POST /api/v1/sessions devuelve el token en claro en el body además de la cookie httpOnly | No devolver el token en el body en el flujo navegador (distinguir cliente API por cabecera explícita) o documentar el trade-off como riesgo residual aceptado en ADR-0260/modelo de amenazas. |
| R01-014 | MEDIA | CERRADO (10s) | Logout no revoca la sesión firmada; un token exfiltrado sigue válido hasta el TTL (15 min) | Tabla de revocación por sessionId consultada en resolvePrincipal, o declarar explícitamente 'TTL corto sustituye revocación' como decisión en ADR-0260/modelo de amenazas. |
| R01-020 | MEDIA | CERRADO (10s) | secure-logger: lista de claves sensibles incompleta (birthDate, content, addendum, substance, reaction, occupation, maritalStatus, title no se redact… | Ampliar la lista con los nombres de campo reales del dominio o invertir a allowlist, más un test que pase payloads reales por redact(). |
| R01-026 | MEDIA | CERRADO (10t) | Ninguna lectura de PHI se audita; append_audit_v17 solo se invoca al escribir comandos | Registrar accesos de lectura a expedientes individuales (documentDetail, patientVitals, readPatientRecordRows, demographics, receta impresa) en una tabla de auditoría de acceso; corregir la frase de ADR-0230. |
| R01-031 | MEDIA | CERRADO (10s) | Comentario 'guard duro' sobreestima un chequeo 100 % cliente sobre sessionStorage | Renombrar el comentario (es un atajo de UX) y, si se quiere control real de página, comprobar la cookie en middleware.ts (ver R01-032). |
| R01-004 | BAJA | CERRADO (10s) | directEndpoint(): manipulación de connection string con regex; produce '?&' si channel_binding va primero (BAJA/MEDIA) | Usar new URL(raw) + hostname.replace('-pooler','') + searchParams.delete('channel_binding') en un único helper compartido por app y scripts. |
| R01-015 | BAJA | CERRADO (10s) | derivedUuid() no genera UUID conforme a RFC 4122 (nibbles de versión/variante sin fijar) | Fijar nibbles de versión (4) y variante (8-b) en derivedUuid/subjectToActorId como ya hace derivedClientUuid, o renombrar el helper para no prometer conformidad UUID. |
| R01-022 | BAJA | CERRADO (10s) | packages/idempotent-command: canonicalHash aplana claves anidadas (JSON.stringify con replacer-array) y usa 'as any'; código de generación v12 | Eliminar el paquete (re-lineando el manifiesto de evidencia, K-01/G-03) o corregir a canonicalización recursiva (como packages/canonical-json) y quitar el 'as any'. |
| R01-023 | — | CERRADO (10w) | Observación cruzada: 8 módulos *-lifecycle.ts completos no cableados a ninguna ruta (declarados en not-wired-registry) | Retirar los clasificados DUPLICATE_OF_WIRED/OVERLAPS_WIRED (clinical-inbox, lab-order, prescription) y decidir los verticales reales (imaging, adaptive-history); los de IA siguen en pausa (R6). |
| R01-027 | — | CERRADO (10w) | Observación: IDEMPOTENCY_IN_PROGRESS parece inalcanzable en el diseño todo-en-una-transacción de v3 | Sin impacto de seguridad; documentar la rama como defensiva o eliminarla junto con el mapeo en http-errors.ts. |

### `R02a` — Lifecycles clínicos núcleo (encuentro, nota, receta, resultados, problemas, paciente…) (33 pendientes)

| ID | Sev | Status | Hallazgo | Qué falta / estado actual |
|---|---|---|---|---|
| R02a-ENC-01 | CRÍTICA | CERRADO (10x) | El timestamp de la firma (signedAt) lo elige el cliente y queda sellado dentro del propio hash de integridad; la columna de reloj de servidor existe … | Leer la columna `recorded_at` real (o dejar de llamar `recordedAt` al occurred_at del cliente) en las lecturas de clinical-runtime. |
| R02a-MED-01 | CRÍTICA | CERRADO (10y) | if(ing) hace que cualquier fármaco fuera del catálogo demo omita en silencio 6 de las 8 barreras de seguridad, sin error, sin log, sin registro de "n… | El `if(ing)` sigue en PROPOSE (L42-48) como pre-chequeo mudo; `monitoringFor(drugCode)` devuelve [] para fármacos fuera de catálogo sin señal (ninguna obligación de monitoreo y sin aviso, L109-118); el catálogo sigue siendo "subconjunto de demostración" (38 p… |
| R02a-MED-02 | CRÍTICA | PARCIAL | handleMedicationModification y handleMedicationReconciliation son inalcanzables — SIEMPRE lanzan CONFLICT porque la state machine no permite auto-tra… | `handleMedicationReconciliation` (L262-269) sigue sin ruta (no hay `reconciliation/route.ts`): declarado como deuda ligada a las verticales hospitalarias. |
| R02a-RES-01 | CRÍTICA | CERRADO (10y) | classifyLab no recibe ni valida unidad — un valor correcto en una unidad distinta a la asumida se clasifica como crítico (o al revés) de forma silenc… | `unit` sigue opcional en ReceiveBody (L23): sin unidad se asume la canónica (`unitAssumed:true`) en vez de exigirla en la API (la UI sí la exige). lab-order-lifecycle.ts:92 sigue llamando classifyLab sin unidad (código muerto). |
| R02a-DOC-02 | ALTA | CERRADO (10x) | Mismo patrón de firma sin cédula y con timestamp de cliente que en Encounter (ver ENC-01/02) | Igual que ENC-02: cédula autodeclarada (solo formato) y fuera de `signatureDigest`. |
| R02a-ENC-02 | ALTA | CERRADO (10x) | "Physician Control" es solo un string de rol en claims; no hay verificación de cédula profesional del firmante | La cédula es autodeclarada por el médico (solo formato; sin verificación contra registro DGP/SEP ni vigencia) y NO forma parte de `signatureDigest` (L97 sigue `encounterId:version:contentHash:claims.sub:signedAt`). |
| R02a-ENC-03 | ALTA | CERRADO (10x) | Estado AMENDED del encuentro es inalcanzable: el dominio lo declara, el fold lo rechazaría, ningún lifecycle lo emite | Retirar AMENDED/CANCELLED (y las transiciones muertas) de EncounterState/allowed, o implementar handler + kind en el fold. |
| R02a-INBOX-01 | ALTA | CERRADO (10x) | clinical-inbox-lifecycle.ts (dead code) escribe SIEMPRE con expectedVersion:0, incluso para transiciones sobre un agregado ya existente; sin máquina … | Retirar el fichero (el vertical vivo es obligation-lifecycle.ts). |
| R02a-LAB-01 | ALTA | CERRADO (10x) | lab-order-lifecycle.ts (dead code) escribe eventos sobre el MISMO aggregate type DiagnosticResult que la vía viva con un vocabulario de kind incompat… | Retirar el fichero (recomendación del propio registry; pendiente G-03/K-01). |
| R02a-PAT-02 | ALTA | PARCIAL | Sin detección de duplicados/MPI al alta, sin fusión de pacientes, sin concepto de tutor/guardián para menores | Sin fusión de pacientes: patient-fold L7 no tiene kind `MERGED` ni hay endpoint; la coincidencia es exacta (CURP o nombre+fecha), sin coincidencia probable. |
| R02a-RES-02 | ALTA | CERRADO (10y) | Resultado corregido: existe un dominio formal (correctResult, supersedes) pero CERO camino de código lo alcanza; además hay 3-4 modelos de estados de… | Siguen modelos paralelos sin integrar: `order-result-domain.correctResult` (8 estados, nunca llamado; solo se importan tipos), `clinical-safety/src/invariants.ts` (15 estados), `packages/result-correction` (cuyo comentario L1-5 aún dice que el ciclo de vida "… |
| R02a-RX-01 | ALTA | CERRADO (10x) | La "receta" (documento legal de prescripción) no existe como funcionalidad alcanzable; el módulo que la implementaría está confirmado muerto | Retirar prescription-lifecycle.ts + prescription-studio (deuda declarada en el tracker, punto 10 / G-03). |
| R02a-RX-02 | ALTA | PARCIAL | El "render" de receta no renderiza nada visual y la "verificación" no verifica integridad real | Retirar el paquete prescription-studio (o corregir render/verify si se conserva). |
| R02a-RX-03 | ALTA | PARCIAL | Cero campos legales mexicanos de receta (cédula, domicilio del consultorio, institución del título, grupo de controlados, antibiótico) en Prescriptio… | Retirar el módulo muerto; los campos legales ya viven en prescription-print. |
| R02a-CON-01 | MEDIA | CERRADO (11a) | "Firma" de consentimiento es un nombre de texto libre sin verificación de identidad ni vínculo con menor/tutor | La firma sigue siendo `signerName` texto libre: sin artefacto de firma (imagen o hash de documento firmado) ni verificación de identidad del firmante. |
| R02a-DOC-03 | MEDIA | CERRADO (10x) | Dos aggregate roots de "nota clínica firmada" (Encounter y Document) sin relación obligatoria ni sincronizada | Decidir una única fuente de verdad de la nota firmada, o hacer encounterId obligatorio y validarlo contra ENCOUNTER_OPENED al crear el documento. |
| R02a-ENC-04 | MEDIA | CERRADO (10x) | assessment/plan aceptan cualquier string no vacío (incl. un espacio), sin trim ni máximo | `.trim().min(N).max(M)` en AssessBody devolviendo VALIDATION_ERROR. |
| R02a-IMG-01 | MEDIA | ABIERTO | Ni siquiera el propio validador de modalidad DICOM se usa; el "hallazgo crítico -> obligación" que promete el comentario no existe en el código | Al cablear el vertical: validar modalidad y capturar `criticalFinding` explícito que cree la obligación. |
| R02a-MED-03 | MEDIA | CERRADO (10y) | Tablas de tope de dosis (adulto y pediátrico) cubren solo 12 y 6 principios activos de los 29 del catálogo; el resto pasa como checked:false sin avis… | MAX_MG_PER_KG_DAY sigue con 6 principios (L87-89); NOT_COVERED es visible pero no exige confirmación del médico. |
| R02a-MED-05 | MEDIA | ABIERTO | Tablas de proyección encounters/medications/diagnostic_results (0002_clinical_domains.sql) son schema muerto: CHECK con vocabulario que ni el fold ni… | Migración destructiva que las retire (o read-model sincronizado con el vocabulario real del fold). |
| R02a-ORD-01 | MEDIA | CERRADO (10z) | Ninguna orden clínica (ClinicalOrder) vence: sin resultado se queda en ORDERED para siempre, sin obligación ni alerta automática; orderId del resulta… | Consulta/job de órdenes ORDERED más allá de un SLA por prioridad y validación cruzada orderId+patientId al recibir un resultado. |
| R02a-IMM-01 | BAJA | CERRADO (10z) | Nota menor (módulo 16, D BAJA): vaccineCode es string libre sin catálogo/enum (immunization-schedule no se importa) y no hay cruce con alergias antes… | Catálogo de vacunas (usar immunization-schedule) y cruce con alergias registradas antes de ADMINISTERED. |
| R02a-INBOX-01b | BAJA | ABIERTO | Nota menor de estilo dentro de INBOX-01: import dinámico `await import("./clinical-runtime")` en una función cuando el módulo ya se importa estáticam… | Desaparece con el retiro del fichero. |
| R02a-PAT-03 | BAJA | CERRADO (10z) | DECEASED es otro estado fantasma (declarado en el fold, sin ningún endpoint que lo emita) | Implementar handlePatientDeceased (fecha/causa) o retirar el estado del fold. |
| R02a-RX-04 | BAJA | ABIERTO | Extracción de medicationId por slicing frágil de string (artifact.substring(0,36)) | Retirar el módulo (o parsear el JSON del artifact). |
| R02a-ALG-01 | — | PARCIAL | Inventario: classifyLab nivel 3 — sin unidad, sin vectores golden, umbrales "de demostración" sin fuente, solo 24 analitos | Citar fuente por analito y validación médica (declarada en el tracker como acción del dueño). |
| R02a-ALG-02 | — | PARCIAL | Inventario: deltaCheck nivel 3 — hereda el problema de unidad; solo 7 analitos; sin vectores golden ni fuente | Ampliar reglas Δ y citar fuente. |
| R02a-ALG-03 | — | PARCIAL | Inventario: computeNEWS2 nivel 4 — falta cita de versión exacta/año y vectores golden independientes para llegar a 5 | Los vectores de prueba son propios; faltan vectores golden tomados de la tabla oficial RCP y validación médica. |
| R02a-ALG-04 | — | PARCIAL | Inventario: classifyVital nivel 3 — WEIGHT/HEIGHT sin implementar; sin vectores golden; umbrales sin cita | Sigue "PENDIENTE de validación clínica" (L242) y los umbrales adultos no citan fuente. |
| R02a-ALG-06 | — | ABIERTO | Inventario: lookupIcd10/normalizeIcd10 nivel 3 — fail-closed correcto pero catálogo pequeño (pendiente confirmar si es subconjunto demo) | Cargar el catálogo CIE-10 OMS completo desde la fuente autorizada. |
| R02a-DEAD-01 | — | CERRADO (10x) | Hallazgo estructural: 4 de 16 archivos del alcance (prescription, lab-order, clinical-inbox, imaging) están oficialmente NOT_WIRED — 25% del alcance … | Retirar prescription/lab-order/clinical-inbox (duplicados) y decidir el cableado de imaging. |
| R02a-DOCTBL-01 | — | PARCIAL | Preámbulo módulo 2: no existe tabla de proyección `documents` (a diferencia de encounters/medications/diagnostic_results); el estado real vive solo e… | Se cierra con MED-05 (retirar las tablas relacionales muertas). |
| R02a-TPL-01 | — | CERRADO (11a) | Patrón por plantilla: la tríada authz/loadForTransition/commit está copiada (no abstraída) en 12+ lifecycles; el mismo bug de plantilla se repitió en… | Extraer loadForTransition/commit/commitAnnotation genéricos parametrizados por fold/assert en http-command.ts. |

### `R03` — Exactitud clínica de 34 algoritmos (vectores ejecutados) (40 pendientes)

| ID | Sev | Status | Hallazgo | Qué falta / estado actual |
|---|---|---|---|---|
| R03-01 | CRÍTICA | CERRADO (10x) | CKD-EPI 2021 correcto en la fórmula, pero sin verificación de unidad, sin cota de edad pediátrica y sin cota de plausibilidad | La función pura sigue aceptando edad pediátrica y valores implausibles sin unidad (solo la ruta y la guarda los filtran); no hay cota superior de edad en ningún punto (130 años se calcula); Schwartz sigue sin existir. |
| R03-08 | CRÍTICA | CERRADO (11b) | Gradiente A-a: presión atmosférica por defecto 760 mmHg en un producto «México-first» y gradiente esperado inválido con O₂ suplementario | Hacer obligatoria la presión atmosférica (derivarla de la altitud de la sede como dato de tenant) en lugar de 760 + advertencia. |
| R03-10 | CRÍTICA | CERRADO (10x) | `latestResultValueForAnalyte` no devuelve unidad, ni fecha, ni estado del resultado: TODOS los cálculos de laboratorio asumen la unidad y la vigencia | Migrar los consumidores restantes a latestAnalyteReading y modelar la anulación pura de un resultado. |
| R03-14 | CRÍTICA | CERRADO (11d) | `lab-reference`: los rangos son unit-blind, sin sexo, sin edad y sin embarazo; `classifyLab` no recibe unidad | Estratificar RANGES por sexo/edad/embarazo, corregir el umbral HbA1c (≥6.5 anormal), noción de ayuno para glucosa y fuente citada por fila. |
| R03-20 | CRÍTICA | CERRADO (11g) | Trampa de unidades de FIB-4: plaquetas en /µL devuelven 0.00 y el sistema informa «Fibrosis avanzada poco probable» | Cota INVALID_INPUT sobre el resultado en el paquete (FIB-4 < 0.10) y/o unidad explícita en la firma de fib4(). |
| R03-22 | CRÍTICA | CERRADO (11g) | Charlson: 7 de 19 condiciones; faltan TODAS las de peso alto, y el resultado se emite como un Charlson completo | Ampliar el catálogo CIE-10 (o admitir códigos OMS válidos fuera del subconjunto) para que las 17 categorías sean alcanzables; hasta entonces declarar la cobertura real en `coverageNote`. |
| R03-23 | CRÍTICA | CERRADO (11f) | El catálogo de fármacos tiene 27 principios activos y, ante un fármaco que no contiene, afirma seguridad | Cargar el catálogo desde una fuente versionada y citada (RxNorm/COFEPRIS/vademécum) con la versión en la respuesta. |
| R03-24 | CRÍTICA | CERRADO (11f) | Alergia a AINE no bloquea diclofenaco/meloxicam; y una intolerancia a penicilina bloquea TODAS las cefalosporinas | Tabla de cadenas laterales R1 (amoxicilina↔cefalexina sí; ceftriaxona/cefuroxima no) o decisión médica documentada de mantener el bloqueo por clase; regla explícita sulfonamida antibiótica vs no antibiótica. |
| R03-25 | CRÍTICA | CERRADO (11f) | Interacciones ausentes entre fármacos que SÍ están en el catálogo, y divergencia entre la barrera que bloquea y la pestaña que informa | Añadir los cuatro pares restantes (hiperkalemia con TMP-SMX, QT, warfarina+paracetamol) y fuente/fecha por fila. |
| R03-30 | CRÍTICA | CERRADO (11h) | Pronóstico de vacunación: recomienda rotavirus a un niño de 3 años y declara «esquema completo» a un adolescente sin VPH | Validar edad mínima e intervalo mínimo entre dosis (invalidar dosis prematuras) y devolver error explícito ante fecha no parseable. |
| R03-35 | CRÍTICA | CERRADO (11i) | 21 endpoints interpretan datos del paciente y emiten recomendaciones clínicas, y el repositorio se declara «fuera del alcance de dispositivo médico» … | Retirar la autoexclusión (sustituir por 'pendiente de determinación' con la lista de módulos candidatos), tabla de uso previsto por endpoint y advertencia de uso en cada respuesta (decisión del dueño, G-04). |
| R03-03 | ALTA | CERRADO (11b) | CHA₂DS₂-VASc: pesos y umbrales correctos, pero tabla de riesgo anual no monótona y sin contrapeso hemorrágico | Sustituir la tabla por una cohorte monótona citada (p. ej. Friberg 2012) o eliminar el porcentaje; añadir HAS-BLED (o al menos no recomendar anticoagular sin riesgo hemorrágico). |
| R03-04 | ALTA | CERRADO (10x) | CHA₂DS₂-VASc y CURB-65 se calculan sin comprobar que el paciente tenga la enfermedad de base que los hace válidos | Predicado de aplicabilidad en la entrada de ambos paquetes (o al menos no emitir `recommendation` cuando applicable=false) y comprobar J12–J18 en CURB-65. |
| R03-05 | ALTA | CERRADO (11c) | Brecha aniónica sin corrección por albúmina y sin delta-delta; el módulo ácido-base ni la usa | Pasar el AG (corregido) a interpretAcidBase para la rama AG alto vs normal + delta-delta; corregir el caveat obsoleto de metabolic-panel/route.ts:35. |
| R03-06 | ALTA | CERRADO (11c) | Ácido-base: solo implementa Winters (acidosis metabólica); los otros tres trastornos quedan sin verificación de compensación | Implementar las reglas de compensación de alcalosis metabólica y de los trastornos respiratorios agudo/crónico (con indicador de cronicidad o ambos escenarios). |
| R03-07 | ALTA | CERRADO (11c) | Gasometría aceptada sin comprobar coherencia interna (Henderson-Hasselbalch) ni plausibilidad | Validar \|pH calculado − pH medido\| ≤ 0.05 (GAS_PANEL_INCONSISTENT), cotas en el propio paquete y campo de tipo de muestra. |
| R03-09 | ALTA | CERRADO (11b) | IMC: fórmula y cortes WHO correctos, pero inferencia de unidad por magnitud y cero validación de plausibilidad | Unidad explícita obligatoria en talla/peso (rechazar 'in' o convertirla), cotas en el paquete, y percentil IMC-para-edad (o NOT_COMPUTABLE explícito) en pediatría. |
| R03-11 | ALTA | CERRADO (11b) | `latestVitalsByType`: mismo defecto, y sin marca temporal para decisiones de ingreso | Devolver {value,unit,occurredAt} por tipo filtrando por último kind del agregado y exigir ventana máxima (p. ej. ≤8 h para NEWS2/CURB-65) con INSUFFICIENT_DATA: STALE. |
| R03-16 | ALTA | CERRADO (11b) | `bp-staging` clasifica 80/50 mmHg como «Presión normal — Reevaluar anualmente», en contradicción directa con `classifyVital` | Validar sistólica>diastólica en parseBp/stageBloodPressure y devolver NOT_APPLICABLE pediátrico (percentiles) en bp-stage/route.ts. |
| R03-17 | ALTA | CERRADO (11b) | Mapeo CIE-10 de los scores: dependiente del punto decimal, con prefijos incompletos y sin distinguir antecedente de evento activo | Value sets versionados también para CHA₂DS₂-VASc (incl. Z86.7, I70, I11–I15, E13), normalizar el punto en `matches()`, y ampliar el catálogo CIE-10 (34 códigos) para que los criterios sean alcanzables. |
| R03-18 | ALTA | CERRADO (11b) | CURB-65: la confusión se fija en `false` en el servidor; la nota informa pero el puntaje y la recomendación de ingreso ya salieron mal | Sin confusión declarada devolver rango/INSUFFICIENT_DATA en vez de un `risk` único; exigir diagnóstico J12–J18; vigencia de FR/PA. |
| R03-21 | ALTA | CERRADO (11g) | MELD: versión obsoleta para su propósito declarado y sin entrada de diálisis | Corregir las bandas de mortalidad (Wiesner 2003) y, si se quiere priorización, implementar MELD-Na / MELD 3.0 con versión en la salida. |
| R03-26 | ALTA | CERRADO (11f) | Techos de dosis: 12 de 27 fármacos; citalopram 60 mg/día pasa sin alerta; `PRN` y «2 tab» desactivan el control | Techo por vía de administración, duración máxima (ketorolaco 5 d), ajuste por edad y separar `evaluable` de `exceeded` en el contrato. |
| R03-27 | ALTA | CERRADO (11f) | Dosis pediátrica: los 6 máximos mg/kg/día que existen son correctos, pero sin peso no se verifica nada y sobre 40 kg el control desaparece | Bloqueo duro (no 428) para menor sin peso, ampliar la tabla mg/kg y decidir el criterio por edad en vez de 40 kg. |
| R03-29 | ALTA | CERRADO (11f) | Embarazo: warfarina y sulfametoxazol no generan hallazgo; el factor «ELDERLY» se resuelve y no tiene ninguna regla; no existe lactancia | Derivar PREGNANCY del expediente y aplicarlo en la barrera de prescripción; reglas de embarazo por principio activo (sulfonamidas) y lactancia. |
| R03-33 | ALTA | CERRADO (11i) | Cuatro implementaciones distintas del IMC y seis parsers distintos de presión arterial, con resultados divergentes | bmi/route.ts sobre bmiFromVitals; en follow-up usar la talla vigente en cada toma (o marcar heightCarriedForward); validar S>D en parseBp. |
| R03-36 | ALTA | CERRADO (11g) | Los tests de los 19 cálculos no contienen un solo vector golden con fuente citada; validan el código contra sí mismo | Ficheros de vectores golden con cita y valores exactos por calculadora (incluido al menos un vector de unidad incorrecta), y valores exactos en meld.test.ts. |
| R03-37 | MEDIA | CERRADO (11g) | `calculation-engine` y `clinical-numeric` definen exactamente el contrato que falta y no se usan en ningún cálculo | Migrar las calculadoras a executeAlgorithm/CalcResult (o retirar los dos paquetes-fachada, que sobrevivieron a la limpieza K-07). |
| R03-F01 | — | CERRADO (11d) | Tabla de vectores: eAG con A1c 0.1 → eAG −44 mg/dL «Normal»; A1c 50 → 1388 (sin cotas) | Cotas en el propio paquete (A1c ∈ [3,20]) o CalcResult INVALID_INPUT. |
| R03-F02 | — | CERRADO (11h) | Tabla de vectores: INR 12 → mismo texto que INR 5 (sin escalón CHEST INR>10 → vitamina K oral) | Escalones CHEST: 4.5–10 sin sangrado (omitir dosis), >10 (vitamina K oral), sangrado mayor (PCC + vitamina K IV). |
| R03-F03 | — | CERRADO (11d) | Tabla de vectores: Na corregido (Katz) aplicado con glucosa 50 mg/dL (fuera de dominio) → 139.2 «≈ medido» | No corregir (devolver medido) cuando glucosa ≤ 100 mg/dL; declarar el dominio de validez. |
| R03-F04 | — | CERRADO (11d) | Inventario #6: FIB-4 sin ajuste del corte bajo (2.0) en >65 años | Corte inferior 2.0 para ≥65 años (McPherson 2017) o advertencia explícita en la respuesta. |
| R03-F05 | — | CERRADO (11h) | Inventario #13: osmolalidad calculada sin brecha osmolal (la utilidad clínica real) ni término de etanol | Analito OSMOLALITY medida + brecha osmolal (medida − calculada, >10 mOsm/kg) con término de etanol opcional. |
| R03-F06 | — | CERRADO (11h) | Inventario #14: calcio corregido (Payne) sin advertencia en ERC/crítico; albúmina 0.5 g/dL aceptada | Advertencia cuando hay ERC (N18) o albúmina extrema; recomendar calcio iónico. |
| R03-F07 | — | CERRADO (11h) | Inventario #18: INR con objetivo no derivado de la indicación e interpretado en pacientes con ACOD | Distinguir AVK de ACOD (el INR no monitoriza rivaroxabán) y derivar el rango objetivo de la indicación (válvula mecánica 2.5–3.5). |
| R03-F09 | — | CERRADO (11h) | Inventario #21: delta check (7 analitos) sin ventana temporal (un «delta» de 3 años); sin fuente | Ventana temporal por analito en el delta check (p. ej. creatinina ≤7 d para AKI) y fuente por regla. |
| R03-F10 | — | CERRADO (11i) | Inventario #29: monitoreo por clase — 5 clases; obligación no atómica con la prescripción (declarado) | Ampliar el monitoreo (p. ej. AINE crónico, ISRS en ancianos → sodio) y/o crear las obligaciones dentro de la transacción de la prescripción. |
| R03-F11 | — | CERRADO (11i) | Inventario #30: validación de la orden no resuelve «tab/caps» a masa | Resolver la concentración desde la presentación del catálogo en lugar del sufijo del código. |
| R03-F12 | — | CERRADO (11g) | Vacío 1: contrato de resultado de cálculo — ninguna respuesta incluye algorithm, version, authority ni inputsHash | Completar authority/inputsHash (o CalcResult de calculation-engine) y etiquetar las 4 rutas restantes. |
| R03-F13 | — | CERRADO (11f) | Vacío 7: QT / torsades — 0 aciertos, con citalopram y azitromicina en el catálogo | Clase QT_PROLONGING en el catálogo con regla aditiva (citalopram, azitromicina, ondansetrón…) y ajuste de citalopram >60 a. |

### `R04` — Rutas de la API v1 (18 pendientes)

| ID | Sev | Status | Hallazgo | Qué falta / estado actual |
|---|---|---|---|---|
| R04-008 | ALTA | PARCIAL | Cero paginación en listados clínica-wide; Cache-Control ausente en el 100% de las rutas | Añadir limit/cursor a los 6 registros clínica-wide y a regulatory-obligations; paginar la lectura (no solo la respuesta) del worklist. |
| R04-003 | MEDIA | CERRADO (10r) | Árbol legacy /api/{encounters,patients,results}: stubs muertos 501/503 desplegados y alcanzables sin autenticación | Borrar `apps/web/app/api/v1/timeline/route.ts` (o cablearlo a `readPatientTimeline`), regenerar la OpenAPI y corregir la afirmación del lote 6b en el tracker. |
| R04-007 | MEDIA | ABIERTO | IDs de ruta ([xxxId]) sin validar formato UUID antes de tocar el kernel: input mal formado produce 500 INTERNAL en vez de 400 | Validar `ctx.params` con zod `.uuid()` en un helper compartido (o en el futuro wrapper, R04-019) y/o mapear el error 22P02 de postgres a VALIDATION_ERROR 400. |
| R04-010 | MEDIA | ABIERTO | reports no soporta rango de fechas; export no deja registro de auditoría propio de la exportación | Parámetros from/to (o month) en reports; evento o log de exportación {actorId, patientId, contentHash} sin PHI (NOM-024 trazabilidad de accesos), idealmente como parte de la auditoría de lecturas de D-09. |
| R04-011 | MEDIA | PARCIAL | No hay proveedor de IA real; la superficie de alto riesgo (ORDER/PRESCRIBE/SIGN) nunca se ejercita en producción (D-VACÍO); pedía documentar que ai:i… | Pasar el contenido real (`r.summary`/`r.findings`) a `gradeCandidateSafety` (ver R04-F01); la parte estructural (sin tráfico real) no se puede cerrar mientras R6 esté en pausa. |
| R04-012 | MEDIA | PARCIAL | office-settings: GET exige scope de escritura y es el único authorize() del repo que omite purpose; sin rol admin distinto para configuración | Documentar (comentario + ADR-0230) por qué los ajustes no exigen purpose, o exigir TREATMENT/OPERATIONS; decidir qué rol administra los ajustes del consultorio (quitar settings:write a NURSE/PHYSICIAN o crear rol de administración). |
| R04-016 | MEDIA | ABIERTO | 8 módulos *-lifecycle.ts (~950 líneas) implementados sin cablear a ninguna ruta; 3 son duplicados admitidos de verticales ya cableados | Retirar los 3 duplicados (clinical-inbox, lab-order, prescription-lifecycle + prescription-studio) y los módulos de IA en pausa, o cablear los verticales reales (imagen, historia adaptativa); exige re-línea base de evidencia (G-03). |
| R04-002 | BAJA | ABIERTO | Coexisten dos familias de ayudantes HTTP: v1/encounters/route.ts reimplementa derivedUuid/principalFrom y llama a resolvePrincipal directo | Refactor quirúrgico de v1/encounters/route.ts a resolveVerified, principalFrom, requireMutationHeaders/parseJson y buildCommand de http-command.ts (o moverlo a un encounter-lifecycle.ts como el resto). |
| R04-014 | BAJA | PARCIAL | Token de sesión también se devuelve en el cuerpo de la respuesta de login (no solo en cookie httpOnly) | Decisión explícita en ADR-0260 sobre devolver el token en el body (y para quién), o devolverlo solo cuando la petición no venga del navegador (p. ej. `Accept`/cabecera de cliente API). |
| R04-018 | BAJA | ABIERTO | Imports relativos de hasta 8 niveles (../../../../../../../../packages/...) sin alias de paths | Alias `@packages/*` (o workspace nombrado) en tsconfig y migración mecánica de los imports. |
| R04-019 | BAJA | ABIERTO | Ausencia de un wrapper HTTP común (withAuth): boilerplate try/resolveVerified/authorize/toHttpError repetido en cada route.ts de vista | Extraer `withClinicalAuth(scope, purpose, handler)` en http-command.ts (punto natural para validar params UUID —R04-007— y emitir X-Request-Id —R04-F09—) y migrar las rutas de vista. |
| R04-F01 | BAJA | ABIERTO | "Shadow mode" evalúa un candidato hardcodeado, no la salida real (sub-hallazgo [B][BAJA] de R04-011) | Calificar el contenido real (`r.summary`, `r.findings`) o retirar el shadow mode hasta que exista salida generativa. |
| R04-F02 | BAJA | ABIERTO | rfc/cedula del consultorio solo validan longitud (max 20/30), sin regex de formato (superficie de ataque de office-settings, R04-012) | Regex de RFC (SAT: 12/13 caracteres) y de cédula, o retirar `cedula` del consultorio ahora que vive en el perfil profesional. |
| R04-F04 | — | ABIERTO | Clasificación resultado anormal/tipo (estadoOf/tipoOf) por regex sobre el nombre del analito, sin catálogo ni campo modality (§13, nivel 2-3) | Campo `modality`/`orderType` estructurado en el evento de resultado (la orden ya lo tiene: LAB/IMAGING/...) y clasificación desde él. |
| R04-F05 | — | ABIERTO | Estado de obligación regulatoria por fecha (computeStatus): umbral de 30 días 'Próxima' sin fuente normativa (§13, nivel 4, POR VERIFICAR) | Citar la fuente del plazo o declararlo explícitamente como umbral de presentación (configurable en ajustes). |
| R04-F08 | — | PARCIAL | No hay README dentro de apps/web/app/api/ que explique la convención 'route.ts delegante + lifecycle' (§14) | README breve en `apps/web/app/api/` (o sección en AGENTS.md): plantilla de ruta delegante, dónde vive la lógica, scope mínimo, cómo registrar el body en api-body-registry y regenerar la OpenAPI. |
| R04-F09 | — | ABIERTO | Ningún encabezado X-Request-Id devuelto al cliente (requestId solo interno) (§14) | Emitir `X-Request-Id: ctx.requestId` en las respuestas (punto natural: el wrapper de R04-019 o `next.config.mjs` no sirve porque es por petición). |
| R04-F10 | — | ABIERTO | Ningún endpoint expone la versión de API en la respuesta (solo en el path /v1/) (§14) | Cabecera de versión (o declarar en la OpenAPI/ADR que el path es el único mecanismo de versionado y cómo convivirá /v2/). |

### `R05a` — Cockpit del expediente, tramo 1 (page.tsx L1–1951) (20 pendientes)

| ID | Sev | Status | Hallazgo | Qué falta / estado actual |
|---|---|---|---|---|
| WS1-01 | CRÍTICA | PARCIAL | Datos ficticios de pacientes/resultados críticos en el dashboard Inicio, indistinguibles de cargando/error | Sigue el widget 'Mensajes y notificaciones' 100% fijo: inicio.tsx:137 badge literal `3` y :138 tres mensajes inventados ('Nuevo resultado de laboratorio · Hoy 12:45 p.m.', 'Interconsulta aceptada', 'Documento pendiente por firmar') sin rama real ni etiqueta; … |
| WS1-02 | CRÍTICA | PARCIAL | Errores HTTP en timeline/care-gaps tratados como 'confirmado sin hallazgos' en los chips de seguridad | Quedan indicadores que afirman vacío con dato desconocido: views/consulta.tsx:175 'Sin recordatorios pendientes para este paciente.' cuando gaps===null (cargando o error); navCounts (model.tsx:1388-1393) y notifCount (:1400) colapsan a 0 sin indicador neutro;… |
| WS1-04 | ALTA | PARCIAL | El estado de un paciente no se limpia de forma síncrona al cambiar de paciente; contenido del anterior bajo el header del nuevo | selectPatientRaw NO limpia cpSnap, vitHist, refCtx, docsSnap, ciSnap ni docDetail (verificado por grep en model.tsx:1251) y sus efectos (model.tsx:488-498, 501-511, 514-524, 553-563, 586-596) no ponen null antes del fetch: en Signos vitales, al elegir otro pa… |
| WS1-05 | ALTA | ABIERTO | No existe cancelación real de peticiones en vuelo (solo se descarta la respuesta tardía) | Añadir AbortSignal a apiRequest y un AbortController por efecto abortado en el cleanup. (S-05 añadió reintento idempotente y guarda de doble envío, que no cancelan nada.) |
| WS1-08 | MEDIA | PARCIAL | Excepciones crudas (String(e)) expuestas como mensaje de UI en ~15 sitios | Queda model.tsx:1355 `catch(err){setPatMsg(String(err));}` en amendPatient (edición de la ficha del paciente): sigue mostrando la excepción cruda. |
| WS1-09 | MEDIA | ABIERTO | Metas clínicas fijas (HbA1c <7 %, LDL <100, glucosa <100) en el gráfico de tendencias, sin individualización ni nota de meta genérica (anexo: Nivel 3… | Computar la meta en servidor según perfil (edad, embarazo, riesgo CV) o etiquetar en la UI 'meta genérica, individualizar'; citar la fuente y añadir vectores golden. |
| WS1-10 | MEDIA | PARCIAL | Vencimiento fijo de 7 días (in7days) para 'resultado requiere acción' y obligaciones nuevas, sin relación con la gravedad (anexo: Nivel 2) | El cliente sigue fijando 7 días: shared.tsx:310 in7days; shared.tsx:353 resNext 'Requiere acción' envía `dueAt:in7days()` (y `ownerId:uuid()` aleatorio) para cualquier resultado y el servidor lo acepta tal cual (result-lifecycle.ts:139 ActionBody); model.tsx:… |
| WS1-11 | BAJA | PARCIAL | Fallos parciales silenciosos en flujos de múltiples POST secuenciales (signos vitales y órdenes desde la Consulta) | createConsultaOrders model.tsx:795-806 sigue igual: POST secuencial con `orderId:uuid()` nuevo por intento; al fallar la N-ésima muestra solo errMsg(r) sin indicar cuáles órdenes ya se crearon y el reintento del lote las duplicaría. |
| WS1-12 | BAJA | ABIERTO | Dos patrones distintos de manejo de busy/error conviven en el mismo componente | Unificar en un solo hook de mutación (busy/error por acción) y eliminar el estado global `busy/error`. |
| WS1-14 | BAJA | ABIERTO | Vista legacy 'exp' (expediente crudo) con un segundo juego de estado 100 % local nunca poblado por GET, coexistiendo con las vistas reales | Cablear esas secciones al registro real (GET) o retirar el duplicado; mientras tanto, rotular que las listas solo contienen lo creado en la sesión. |
| WS1-15a | BAJA | ABIERTO | scrollToSection navega buscando un <h2> por textContent exacto en todo el DOM | Usar ids/anclas en las secciones y navegar por id. |
| WS1-15b | BAJA | ABIERTO | isReal: función vestigial que siempre devuelve true (resto de filas de ejemplo) | Eliminar la función y sus llamadas. |
| WS1-15c | BAJA | ABIERTO | ixDrugs arranca con fármacos no vacíos ('Sertralina','Ibuprofeno','Metformina') sin aclarar que son de ejemplo | Iniciar vacío o etiquetar explícitamente como conjunto de ejemplo. |
| R05a-F01 | — | ABIERTO | Inventario: Metas de tendencia (HbA1c/Glucosa/LDL/Creatinina) — Nivel 3 — falta individualización, fuente y vectores golden | Ver WS1-09. |
| R05a-F02 | — | ABIERTO | Inventario: followState (clasificación de seguimiento) — Nivel 2 — taxonomía UI sin fuente | Documentar el criterio (o derivarlo de las máquinas formales state-machines/formal/*.json) y probarlo. |
| R05a-F03 | — | ABIERTO | Inventario: DX_LABEL (CIE-10 → etiqueta corta) — Nivel 2 — cobertura parcial (~19 códigos), fallback = código crudo | Derivar la etiqueta del catálogo CIE-10 real (packages/terminology searchIcd10) en lugar de una tabla manual. |
| R05a-F04 | — | PARCIAL | Inventario: in7days (vencimiento de seguimiento) — Nivel 2 — sin relación con severidad/tipo | Ver WS1-10. |
| R05a-F06 | — | ABIERTO | Vacío D: Cancelación real de peticiones (AbortController) ausente en todo el repo | Ver WS1-05. |
| R05a-F07 | — | PARCIAL | Vacío D: Confirmación de acciones irreversibles (firmar, anular factura, revocar consentimiento) ausente | Siguen a un solo clic otras transiciones terminales: inasistencia de cita (agenda.tsx:116 → model.tsx:1284 solo pide motivo en 'cancellation'), alta/traslado de admisión (shared.tsx:426 sin ASK), cicatrización de herida (shared.tsx:401 'healing' sin ASK), com… |
| R05a-F08 | — | PARCIAL | Vacío D: Distinción 'error/desconocido' vs 'confirmado vacío' en todos los indicadores de seguridad del paciente | Extender el patrón chartState (o un estado por recurso) a los demás snapshots por paciente y a los conteos del sidebar. |

### `R06` — Base de datos, RLS, migraciones, outbox (34 pendientes)

| ID | Sev | Status | Hallazgo | Qué falta / estado actual |
|---|---|---|---|---|
| R06-06 | CRÍTICA | PARCIAL | Cero REFERENCES/FOREIGN KEY en las 18 migraciones; tampoco existe una tabla `tenants` | Falta la decisión de aprovisionamiento de tenants (automático desde el IdP vs. administrador) y la migración tenants + FK (ADR-0290 §2, §4 añade la comprobación a db:check). FK entre tablas relacionales muertas descartadas por diseño (§3). |
| R06-22 | CRÍTICA | CERRADO (12a) | Gate de firma de encuentro ('Zero Lost Follow-Up') con escaneos sin índice en el hot path | Índice de expresión (tenant_id, (payload->>'sourceVitalId')) o columna propia, y medir el plan del gate con volumen histórico. |
| R06-27 | CRÍTICA | PARCIAL | El drenado del outbox está roto de punta a punta; no hay evidencia de un worker desplegado en ningún entorno | Decisión del dueño (D-03): construir el consumidor real (claim bajo contexto de tenant, UPDATE en su migración, recibo en outbox_consumer_receipts) o retirar outbox, apps/worker y outbox-claim-v2. |
| R06-03 | ALTA | CERRADO (12h) | `release_evidence`: dos CREATE TABLE IF NOT EXISTS con esquemas incompatibles (0005 vs 0010) | El CREATE TABLE muerto de 0010 sigue en el fichero (inmutable por la regla D-07). Cerrar exige una migración de limpieza (DROP o RENAME a release_evidence_v2) dentro de la retirada de tablas muertas (D-03/D-09, decisión del dueño). |
| R06-04 | ALTA | CERRADO (12h) | `projection_checkpoints`: dos CREATE TABLE IF NOT EXISTS incompatibles (0007 vs 0011), reconocido y esquivado en 0012 | Siguen conviviendo tres tablas de checkpoint (dos esquemas fantasma + la canónica), ninguna con código. Falta la migración de limpieza (DROP de las no usadas) ligada a D-03/D-09. |
| R06-19 | ALTA | CERRADO (12a) | Cero validación de schema del payload clínico antes de persistir | Registro de esquemas por (aggregateType, kind) validado en runClinicalCommand o en el kernel antes del INSERT (los 92 esquemas que ya exporta el registro OpenAPI son reutilizables), o justificar en ADR-0240 por qué la validación en el borde HTTP basta. |
| R06-20 | ALTA | CERRADO (12f+12g) | Consultas de listado ('registro') sin índice de soporte; N subconsultas correlacionadas por fila; sin paginación | Cerrado en tres pasos: índice de orden por fecha (12a, verificado con EXPLAIN); las subconsultas por fila pasan a LATERAL y el filtro por paciente viaja en el SQL (12f: 72 389 → 106 buffers medidos); y los seis tableros devuelven una página con cursor y `total`, con TODOS sus indicadores calculados en la base (12g). Queda anotada para el dueño una cuestión de dominio que apareció al paginar: el folio de facturación se deriva de la posición en la lista, así que emitir una factura renumera las anteriores. |
| R06-21 | ALTA | CERRADO (12a) | latestResultValueForAnalyte/analyteSeries: filtro por analito sin índice, en cascada desde ~12 rutas clínicas | Índice de expresión que incluya (payload->>'patientId'), upper(payload->>'analyte') y occurred_at DESC, o lectura por lotes de analitos por petición; medir antes (ADR-0240 §3). |
| R06-30 | ALTA | PARCIAL | Cero mecanismo de borrado/retención en toda la BD, pese a afirmar cumplimiento LFPDPPP en la UI | Decisiones del dueño (ADR-0280 §Pendientes: criptoborrado vs purga, plazo, menores/fallecidos, procedimiento ARCO) y su implementación con prueba; hasta entonces el claim queda en 'en proceso'. |
| R06-10 | MEDIA | CERRADO (12b) | Cobertura de GRANT extremadamente angosta: 7 de ~45 tablas para medical_os_runtime; medical_os_worker/medical_os_readonly sin ningún privilegio de ta… | Documentar tabla por tabla (o retirar) las ~20 sin grant que no son 'de dominio' (break_glass_*, worker_leases, replay_verifications, signed_record_versions, result_correction_edges, projection_*, encounter_signatures, consumer_receipts, clinical_safety_findi… |
| R06-12 | MEDIA | CERRADO (12b) | Tabla `outbox` parcheada en 5 migraciones distintas con columnas e índices duplicados/redundantes | Migración de consolidación que elimine los índices obsoletos y documente el índice de claim vigente, o retirada del outbox si el dueño lo decide (D-03). Precisión al anexo: la lista real es 0001/0003/0008(no-op)/0012/0014, no '0005'. |
| R06-17 | MEDIA | CERRADO (12e) | El 'restore drill' no verifica RLS/políticas/grants pese a que su comentario lo promete | Incluir políticas/RLS/grants en la huella del drill (pg_policy, relrowsecurity, information_schema.role_table_grants), ejercitar dos tenants en más de una tabla y llevar db:check a bootstrap-db.mts/CI. Además ADR-0250 (Consecuencias) cita 'scripts/v22/live-rl… |
| R06-18 | MEDIA | CERRADO (12h) | Dos tablas de 'break glass' con nombres casi idénticos; una inservible (sin política), la otra funcional | Fuente de verdad DECLARADA en el catálogo (migración 0027, lote 12e): si break-glass se construye, la base es `break_glass_events` —ya trae reviewed_by/reviewed_at y está en denegación total desde 0020—; `break_glass_reviews` queda marcada como duplicado que solo añade `review_status`, derivable. Lo que resta es el DROP de ambas, que es decisión del dueño (D-03/D-09), y la decisión de construir o no la funcionalidad. |
| R06-23 | MEDIA | CERRADO (12h) | `patient_state_projection` (tabla diseñada para evitar exactamente este problema) nunca se escribe ni se lee | Migración de limpieza que la elimine (la rama 'implementarla' queda descartada por ADR-0240 §3). |
| R06-24 | MEDIA | CERRADO (12a) | agendaForDate compara fechas como texto en vez de timestamptz | Castear a timestamptz en la consulta o normalizar startAt con new Date(...).toISOString() antes de persistir. |
| R06-26 | MEDIA | CERRADO (12a) | El guardarraíl assertProductionImport no se invoca fuera de su propio test unitario | Cablear el guardarraíl (script sobre los imports de apps/web hacia packages/*/src, o regla no-restricted-imports) o retirarlo junto con packages/audit-ledger si ya no protege nada (K-01/K-07). |
| R06-13 | BAJA | CERRADO (12a) | CHECK agregado NOT VALID en `obligations` y nunca validado | Una línea `ALTER TABLE obligations VALIDATE CONSTRAINT obligations_owner_due_ck` en una migración nueva, o el DROP de la tabla con la limpieza de tablas relacionales muertas (D-03/D-09). |
| R06-15 | BAJA | CERRADO (12b) | Roles duplicados entre db/roles_v16.sql y la migración 0016, con atributos ligeramente distintos | Una sola fuente de verdad para los roles (migración numerada o fichero, no ambos) y decidir si medical_os_readonly/medical_os_worker —sin usuarios ni grants— se conservan. |
| R06-16 | BAJA | CERRADO (12e) | Evidencia autodeclarada desalineada del código real en restore-drill.mts ('0001..0017') | Generar el rango dinámicamente (`${files[0]}..${files.at(-1)}`) y aplicar las migraciones vía el migrador para que `pnpm db:check` sea válido sobre la base restaurada. |
| R06-29 | BAJA | CERRADO (12a) | assertTenantContext no valida formato UUID, solo 'truthy' | Validar formato UUID en assertTenantContext (o en http-principal al construir el contexto) con SAFETY_BLOCKED explícito. |
| R06-F01 | — | CERRADO (12a) | Tabla 1.2 fila (a): modelo clínico casi vacío, contenido en jsonb sin esquema — 'SIGUE' | Lo mismo que R06-19. |
| R06-F04 | — | CERRADO (12h) | Tabla 1.2 fila (d): dos CREATE TABLE IF NOT EXISTS incompatibles (release_evidence, projection_checkpoints) — 'SIGUE' | Migración de limpieza (véase R06-03/R06-04). |
| R06-F06 | — | PARCIAL | Tabla 1.2 fila (f): cero REFERENCES/FOREIGN KEY — 'SIGUE, 100%' | Véase R06-06. |
| R06-F09 | — | CERRADO (12c) | Vacío (D): no hay prueba de integración que ejercite RLS tabla por tabla (solo clinical_events vía restore-drill) | Prueba en vivo que recorra pg_tables con relrowsecurity e inserte/lea con dos tenants bajo medical_os_runtime, al menos en las tablas con grant. |
| R06-F10 | — | CERRADO (12d) | Vacío (D): ningún job/endpoint purga expires_at vencidos de idempotency_keys/command_idempotency ni dead_letter_at de outbox | Purga con el rol propietario de command_idempotency con expires_at < now() y de outbox en DEAD_LETTER, o declarar el TTL en ADR-0250/0031. |
| R06-F11 | — | CERRADO (12e) | Vacío (D): sin documentación que declare cuál de las versiones duplicadas de cada paquete/tabla es la vigente | Una línea por duplicado restante en ADR-0240 §4 o en el README (qué se retira, qué se reserva). |
| R06-F12 | — | CERRADO (12e) | Vacío (D): docs/runbooks/backup-dr.md implica una verificación (restoreErrors) más fuerte de lo que el drill ejecuta | Reforzar el drill (R06-17) o rebajar el texto del runbook a lo que realmente verifica. |
| R06-F13 | — | PARCIAL | Tabla 5: cadena de hash de auditoría (app.append_audit_v17) — nivel 4; falta verificación independiente expuesta y vector golden versionado | Vector golden versionado y verificación independiente hechos en el lote 12c: `live-concurrency-and-audit-vector-proof.mts` reproduce el digest de la cadena FUERA de Postgres, incluido el orden de claves del jsonb y el centinela GENESIS. Lo que resta para el nivel 5 —exponer el informe de verificación a un tercero— es decisión del dueño, no ingeniería. |
| R06-F14 | — | CERRADO (12c) | Tabla 5: concurrencia optimista (aggregate_versions) — nivel 4; falta test de carrera real y manejo HTTP explícito de CONCURRENCY_CONFLICT | Prueba en vivo con Promise.all de dos comandos sobre el mismo agregado y misma expectedVersion esperando exactamente un 409. |
| R06-F15 | — | CERRADO (12d) | Tabla 5: idempotencia de comandos (command_idempotency) — falta expiración/limpieza de filas expires_at vencidas | Job/script de purga con el rol propietario (el de la app no tiene DELETE) o TTL documentado. |
| R06-F16 | — | PARCIAL | Tabla 5: claim de outbox con lease + backoff (outbox-claim-v2) — nivel 3, sin llamador ni GRANT | Igual que R06-27. |
| R06-F18 | — | CERRADO (12a) | Tabla 5: reconstrucción de estado por plegado de eventos — nivel 3 por falta de índices y de validación de payload | Véanse R06-19/20/21/22. |
| R06-F19 | — | CERRADO (12e) | Tabla 5: restore/DR drill — nivel 3, cobertura parcial (1 de ~30 tablas con RLS, sin políticas/grants) | Véase R06-17. |
| R06-F20 | — | CERRADO (12e) | Tabla 5: backup admission gates (backup-restore, backup-verifier) — nivel 1, funciones puras sin E/S real | Retirar backup-restore (K-01/K-07) o conectarlo al gate del drill. |

### `R09` — Documentación, ADR, gestión de riesgo y cumplimiento (29 pendientes)

| ID | Sev | Status | Hallazgo | Qué falta / estado actual |
|---|---|---|---|---|
| R09-002 | CRÍTICA | PARCIAL | ADR-0031 promete un outbox reconciliable; no hay worker que lo procese | Sigue sin consumidor y sin fecha límite; CAP-ASYNC-001 'Reliable Async Delivery & Transactional Outbox' sigue `APPROVED` en docs/adjudication/golden-slice-adjudication.json y `FAIL_CLOSED` en capabilities/catalog.json pese al addendum. Cierre: decisión del du… |
| R09-006 | CRÍTICA | ABIERTO | Autoexclusión de NOM-241/ScDM por categoría de producto, no por función, con evidencia vacía | Análisis de intended-use por capacidad (eGFR/ERC, CHA₂DS₂-VASc, CURB-65, MELD, NEWS2, FIB-4, Charlson, prescription-check) contra criterios de CDS/ScDM — dueño con asesor regulatorio (G-04). Ingeniería puede, mientras tanto, dejar de afirmar 'fuera del alcanc… |
| R09-020 | CRÍTICA | PARCIAL | c5-acceptance-dossier.md: 77 capacidades 'propuestas' por el mismo script que arma el dossier; la tabla de firma humana está 100% vacía | La firma humana es del dueño con un médico y el responsable regulatorio (G-03/P-09). En ingeniería falta el bloqueo de CI mientras `accepted` esté vacío para las C5 de medicación (hoy `capability:check` solo bloquea en `--strict` y por caso de seguridad, no p… |
| R09-024 | CRÍTICA | PARCIAL | Colapso ~97% entre el análisis de riesgo planeado (256 hazards / 303 invariantes) y el que realmente quedó ejecutable (6 hazards / 8 invariantes) | La decisión es en bloque, no peligro por peligro, y el análisis ISO 14971 por función clínica (calculadoras, gate de firma, resultados críticos, vacunación, agenda) sigue pendiente; 188 de 208 capacidades C4/C5 del catálogo siguen sin caso (`capability:check`… |
| R09-025 | CRÍTICA | PARCIAL | El único control de 'aplicabilidad clínica/contexto pediátrico' admite en su propia definición que la mitad de su verificación es trabajo futuro no i… | G-10: apuntar la verificación de CTL-0008 al test unitario y a la prueba en vivo del gate pediátrico y quitar el prefijo `future:`; mientras, CAP-APPLICABILITY-001 sigue FAIL_CLOSED con un método de verificación declarado como futuro. Ingeniería. |
| R09-001 | ALTA | CERRADO (13b) | ADR-0040 exige persistencia relacional versionada; el código vive en jsonb sin esquema | ADR-0040 sigue `Status: ACCEPTED` sin marca SUPERSEDED ni referencia a ADR-0240 (un lector de 0040 no sabe que está superado) y ADR-0240 no nombra quién decidió. Ingeniería. |
| R09-005 | ALTA | CERRADO (13b) | Quince ADRs consecutivos (v7→v21) repiten 'producción bloqueada hasta X' sin que X se resuelva nunca dentro de la serie | Falta un ADR de cierre o un addendum fechado en ADR-0210 que diga qué bloqueadores de la serie siguen abiertos hoy (P-01 CI, G-03 aceptación humana C5, G-04 clasificación) y cuáles cerraron (Postgres vivo, RLS, 97 pruebas en vivo). Ingeniería. |
| R09-007 | ALTA | CERRADO (13a) | El test 'enforzado' del registro de compliance solo verifica que los archivos citados existan, no que la norma se cumpla | Renombrar la afirmación del README ('valida que las citas no estén rotas') y, si se quiere sostener 'enforzado', añadir al menos una prueba de contenido (p. ej. que 0013 contenga `append_audit_v17` con hash encadenado). Ingeniería. |
| R09-008 | ALTA | PARCIAL | LFPDPPP: sin aviso de privacidad, sin flujo ARCO, sin mención de encargados (Vercel/Neon/Auth0) ni de transferencias internacionales o notificación d… | Falta el registro de encargados (Vercel, Neon, Auth0: rol, región, transferencia internacional), un borrador de aviso de privacidad y un procedimiento de notificación de vulneraciones (G-12). Ingeniería redacta; validación legal del dueño. |
| R09-016 | ALTA | PARCIAL | El 'veredicto' del scaffold-audit ('sin contradicciones con los 3 documentos') es una autoevaluación de IA, no una auditoría independiente, y ya está… | Anotar el veredicto de scaffold-audit como superado (fecha + enlace a la auditoría del 19-sep) y repetir el ejercicio con un revisor humano independiente. Ingeniería (nota) + dueño (revisor). |
| R09-021 | ALTA | PARCIAL | CAP-MEDICATION-001, la única capacidad de seguridad clínica llamada 'medicación', está vacía y bloqueada — y ninguna de las capacidades de prescripci… | El desajuste de IDs persiste: CAP-MED-AUTH-003 sigue en capabilities/catalog.json con `hazards: []` y BLOCK_UNTIL_HAZARD_CASE_COMPLETE; las 7 capacidades de gates del dossier (CAP-DOSE-CEILING-001, CAP-DRUG-INTERACTION-001, CAP-RENAL-DOSING-001, CAP-PEDIATRIC… |
| R09-026 | ALTA | ABIERTO | Los 6 hazards documentados usan una sola severidad ('S1') sin probabilidad ni matriz de riesgo — no es un análisis ISO 14971 completo, es una lista d… | Añadir probabilidad (aunque cualitativa) y evaluación explícita de riesgo residual con criterio de aceptabilidad; el formato ya admite extenderse. Ingeniería con médico (G-02). |
| R09-032 | ALTA | PARCIAL | Sin CONTRIBUTING, sin CHANGELOG, sin glosario, sin referencia de API (OpenAPI) pese a ~150 rutas | Faltan CONTRIBUTING, CHANGELOG y un glosario de prefijos (CAP/ENG/EXEC/PROD/TRL/RG/HAZ/INV/CTL) — G-12. Ingeniería. |
| R09-003 | MEDIA | PARCIAL | 24 de 25 ADRs son plantillas de 3-7 líneas sin fecha/autor/opciones | Añadir encabezado mínimo (Fecha / Decidido por / Alternativas) a los ADR vigentes 0011, 0012, 0030, 0031, 0032 y autor+alternativas a 0230–0290. Ingeniería (10 min por fichero). |
| R09-009 | MEDIA | CERRADO (13d) | NOM-004 (conservación ≥5 años): el registro admite el hueco pero nunca cita el plazo legal | La entrada NOM-004 del registro (línea 23) sigue sin citar el plazo ni enlazar ADR-0280; la retención/purga no está implementada (ADR PROPUESTO, decisión del dueño: criptoborrado vs purga). Ingeniería para el registro; dueño para la decisión. |
| R09-015 | MEDIA | ABIERTO | Ninguna de las 20 revisiones tiene un revisor independiente; todas son el mismo agente autoevaluándose | Una revisión humana registrada (médico y/o segunda persona) al menos de las capacidades C5 de medicación, y protección de rama con revisión (P-13). Dueño (con médico). |
| R09-018 | MEDIA | PARCIAL | Los contratos de diseño en docs/ no se importan desde la aplicación real; solo hay comentarios que los mencionan | 9 de los 11 ficheros `contracts/*.ts` y `design/*.ts` (app-shell, component-anatomy, content-limits, responsive, breakpoints, motion, typography…) siguen sin importador ni guarda de sincronía; sigue siendo copia manual en vez de una sola fuente (paquete). Ing… |
| R09-022 | MEDIA | CERRADO (13a) | Colisión de nombres entre CAP-CLINICAL-INTEL-001 (NOT_WIRED) y CAP-CLINICAL-INTELLIGENCE-001 (aprobada) | Renombrar uno de los dos (p. ej. CAP-CLINICAL-INTEL-CORE-001 / CAP-CLINICAL-SUMMARY-001) en reconciliación, dossier y not-wired-registry. Ingeniería. |
| R09-033 | MEDIA | CERRADO (13d) | Un solo runbook (backup-dr.md) en todo el repo; sin runbook de incidente, sin rotación de secretos | Dos runbooks cortos: 'sospecha de fuga/incidente de seguridad (contención, a quién avisar, notificación)' y 'rotación de SESSION_SIGNING_SECRET / DEV_IDENTITY_SECRET / credenciales Neon y Auth0 sin downtime' (G-12). Ingeniería redacta; dueño designa responsab… |
| R09-004 | BAJA | PARCIAL | ADR-0000..ADR-0010 nunca se crearon pese a ser la primera recomendación de gobierno | No existe ADR-0000 ni la serie 0001–0010; el rastro está solo en SPEC_INDEX. Ingeniería (un ADR-0000 corto que remita a SPEC_INDEX y a 0230–0290). |
| R09-010 | BAJA | CERRADO (13d) | NOM-024 no menciona CURP pese a que el código lo captura como identificador de paciente | Añadir CURP (validación oficial, uso como identificador secundario) a `addressedBy`/`evidence` de NOM-024 citando `packages/mx-identity` y `scripts/v22/live-patient-identity-proof.mts`. Ingeniería, edición trivial. |
| R09-014 | BAJA | PARCIAL | No se modela la autorización por relación médico-paciente (BOLA); STRIDE de 6 filas para ~150 rutas | Sigue sin fila STRIDE propia para 'médico ve/edita paciente no asignado' y el control (relación asistencial / break-glass) no existe por decisión de producto. Ingeniería (fila) + dueño (decidir cuándo aplica). |
| R09-023 | BAJA | ABIERTO | Mapping_Adjudication.csv (el registro autoritativo de aceptación humana) tiene 0 filas de datos | Decisión del dueño (G-11): archivar formalmente el registro heredado (y actualizar docs/adjudication/README.md, que aún remite a él) o adjudicar los 115 mapeos; la aceptación humana C5 sigue en cero en ambos registros. |
| R09-027 | BAJA | CERRADO (10r) | safety/hazards.json y safety/invariants.json son arreglos vacíos que conviven con core-hazards.json/core-invariants.json poblados | Retirar los dos ficheros y apuntar RG-002/RG-003 y self-check a core-invariants.json/core-hazards.json (o poblarlos), para que la cobertura de invariantes deje de ser un gate vacío. Ingeniería. |
| R09-028 | BAJA | CERRADO (13a) | safety/cases/v15/, v16/, v17/, v18/ son reliquias de versiones retiradas del andamio, sin referencia desde nada vigente | Archivar en safety/cases/_retired/ o borrar. Ingeniería, trivial. |
| R09-034 | BAJA | ABIERTO | Sin manual de usuario/instrucciones de uso para el clínico final | Documento breve por función crítica: significado de UNKNOWN / NOT_EVALUATED / CONFLICTING / 428 SAFETY_ACK_REQUIRED y qué hacer ante cada uno. Ingeniería con médico. |
| R09-F02 | — | PARCIAL | Inventario de algoritmos clínicos — fidelidad documental: ningún documento de docs/ transcribe fórmula, unidades, umbrales ni fuente primaria de los … | Una ficha por algoritmo en docs/ (fórmula, unidades esperadas, umbrales, versión y fuente primaria) o generarla desde el código; validación por un médico (transversal del doc de remediación). Ingeniería + médico. |
| R09-F03 | — | PARCIAL | Diez afirmaciones documentales que el código desmiente (tabla docs ↔ código) | Quedan la fila 5 (registro NOM-241, dueño + asesor regulatorio) y la fila 8 (regenerar dossier y actualizar la reconciliación al contrato fail-closed del lote 1; ingeniería), más la higiene de las filas 1-2. |
| R09-F04 | — | PARCIAL | Vacíos: lo que falta para ser un desarrollo serio visto desde docs/ (lista de 12) | Hechos 3/12 (7, 9, 12); parciales 5/12 (2, 4, 6, 8, 10); abiertos 4/12 (1, 3, 5, 11). Los abiertos 3, 5 y 11 son de ingeniería; el 1 es del dueño con médico y responsable regulatorio. |

## Correcciones al propio documento de auditoría

El cruce encontró afirmaciones de los anexos que ya eran falsas o imprecisas el 19-sep. Se registran porque el documento
de auditoría es la línea base del proyecto y conviene que su fe de errores viva en el repo:

- **R01-025** (ALTA, "atribución falsa de comandos de IA"): el hardcode `actor_type:'HUMAN'` era real, pero los lifecycles
  de IA ya estaban en `not-wired-registry.json` sin ruta, así que no podía ocurrir en producción. Severidad sobreestimada.
- **R01-010 / R01-009**: el bypass del verificador de identidad de desarrollo exigía un *entrypoint* no estándar
  (`next build`/`next start` fijan `NODE_ENV=production`); y "en Node 22 `node fichero.ts` falla por sintaxis" ya no era
  cierto (Node 22.18+ elimina tipos). Los defectos estructurales sí existían.
- **R01-036**: `DEBUG_PRINT_LIMIT` no es una variable de la aplicación, sino de la librería de pruebas.
- **R01-023 / R02a (MED-02, PRB-01, MED-06)**: hablan de *endpoints* que "fallan al 100 %" y de verticales "sin ruta" que
  en `a537ea5` no tenían ruta en absoluto (los handlers eran inalcanzables), y presentan como no cableados a prescripción
  y órdenes, que sí lo estaban. El bug era real pero latente.
- **R04-F07** ("no hay pruebas de integración HTTP"): ya existían 87 pruebas en vivo que importan los `route.ts` reales y
  los invocan contra Postgres; el anexo no miró fuera de `apps/web/app/api`.
- **R04-006** está etiquetado ALTA aunque su propio texto lo describe como fortaleza.
- **R09-011**: el activo `audit_chain_v3` sí tenía RLS forzada (migración 0012); la tabla sin RLS era `audit_ledger`,
  legado muerto. El hueco existía, la severidad CRÍTICA no correspondía al activo nombrado.
- **R09-027** era falso en su premisa ("sin referencias desde código") y **subestimaba** el problema: `safety/hazards.json`
  y `safety/invariants.json` están vacíos y **sí tienen lectores** (`packages/clinical-safety`, `release/self-check.mjs`),
  de modo que los gates RG-002/RG-003 se evalúan sobre un arreglo vacío y **pasan vacíamente**. Es el hallazgo más
  accionable de todo el cruce y no estaba en el documento principal.
- **R04-003** omitió `apps/web/app/api/v1/timeline/route.ts`: un *stub* que devuelve 503 sin autenticación, publicado como
  `GET 200` en la OpenAPI, y que el tracker de remediación afirmaba haber eliminado.

## Qué se hace con esto

1. **Lo que es ingeniería pura** (sin decisiones del dueño) entra por lotes en el tracker de remediación, empezando por lo
   que degrada una garantía: gates que pasan vacíamente, rutas que mienten sobre su estado, evidencia de control que
   apunta a `future:`, y textos que afirman lo que el código no hace.
2. **Lo que es residuo declarado de un hallazgo ya cerrado** (contenido clínico por validar, catálogos de demostración,
   tablas pediátricas incompletas) queda en la "Deuda declarada" del tracker: se cierra con la validación médica y con la
   ampliación de contenido, no con más código.
3. **Lo que exige una decisión del dueño** (retirar el outbox y las tablas muertas, tenants y claves foráneas, retención y
   borrado de PHI, verticales hospitalarias, aceptación humana C5, uso previsto, facturación de Actions, protección de
   rama) sigue en la sección de acciones del dueño: aquí solo se añade la evidencia fina que lo respalda.
