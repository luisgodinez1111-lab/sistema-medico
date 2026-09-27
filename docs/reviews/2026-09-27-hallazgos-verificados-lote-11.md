# Hallazgos verificados durante el refactor arquitectónico (lote 11)

El análisis de arquitectura del lote 11 (ADR-0300) encontró defectos de comportamiento que **no se corrigen dentro del
refactor**: son cambios de comportamiento clínico o de integridad (C4/C5 en su mayoría) y, según AGENTS.md, cada uno exige su
invariante y su prueba, y la validación que corresponda. Cada hallazgo se verificó de forma adversarial y se **reprodujo en
vivo** contra una base PostgreSQL desechable (plantilla con las 22 migraciones), llamando a los módulos de ruta reales. Ningún
fichero del repositorio se modificó para reproducirlos. Verificados sobre `e021a60` (antes del lote 11).

| ID | Gravedad | Qué falla | Reproducción en vivo | Corrección (esbozo) | Requiere |
|---|---|---|---|---|---|
| D1 | **Crítica** | Los read models de signos vitales (`latestVitalsByType`, `patientVitals`) solo leen eventos `RECORDED`: ignoran `AMENDED` y `ENTERED_IN_ERROR`. | Niño de 5 años, peso 70 kg corregido a 7 kg: `prescription-check`, PROPOSE y PRESCRIBE siguen usando 70 kg; como 70 > 40 kg la barrera pediátrica mg/kg (INV-CORE-0011) queda `NOT_APPLICABLE` y paracetamol 500 mg c/6 h (285,7 mg/kg/día, 3,8× el máximo) se acepta (201); con el peso capturado directamente en 7 kg la misma orden se bloquea (403). Un signo vital marcado como erróneo sigue alimentando NEWS2 (bandera roja), IMC, estadio de PA, CURB-65 y el panel. | Estado actual por agregado de signo vital (último `RECORDED`/`AMENDED` con valor, excluir `ENTERED_IN_ERROR`), como ya hace `countOpenCriticalVitals`. | INV + TEST; validación médica |
| D4 | **Crítica** | Los 24 folds aceptan un primer evento de tipo desconocido como su propio génesis y `readAggregateEvents` no filtra por `aggregate_type`: una transición puede escribir en el stream de OTRO agregado. | `POST /allergies/{patientId}/refutation` con `If-Match: 1` sobre un paciente recién registrado guarda un evento de alergia en el stream del paciente; desde entonces enmendar, desactivar o reactivar al paciente responde 500 para siempre (event store append-only). En la dirección inversa se apaga en silencio una alergia activa. | Génesis solo cuando `payload.kind` falta (caso documentado); lectura filtrada por tipo de agregado; stream ajeno ⇒ 404. | INV + TEST (integridad) |
| D2 | Alta | Las enmiendas de paciente son deltas dispersos; `listPatients` y `patientDemographics` solo combinan la ÚLTIMA enmienda con el registro. | Tras enmendar nombre y fecha de nacimiento y después solo el teléfono, la lista, la demografía, la edad de la prescripción, la TFG, el gate de tutor de menores y la receta vuelven a los datos del registro (el fold sí es correcto). | Proyección campo a campo con el último evento que trae cada campo (como `foldPatient`). | INV + TEST; validación |
| D3 | Alta | Un documento con adjunto no puede finalizarse, firmarse ni enmendarse (500), ni siquiera tras retirar el adjunto; la lista muestra firmados como «Borrador». | Evento `ATTACHED` añadido por el kernel a un documento: finalizar/firmar/enmendar → 500; la lista lo muestra `DRAFT`. | Tratar `ATTACHED`/`ATTACHMENT_REMOVED` como anotaciones en el fold y en las proyecciones. | INV + TEST |
| D5 | Alta | Los comandos derivados (obligaciones de monitoreo de fármacos y de resultado crítico) solo se ejecutan en el primer intento: un reintento tras un fallo posterior al commit principal nunca los crea. | Con el cubo de tasa del actor agotado entre ambos: warfarina PRESCRIBED sin obligación `MONITOR_INR`; resultado crítico sin obligación URGENTE; el reintento responde éxito (replay). | Ejecutar los derivados también en el camino de replay (ya son idempotentes por sus llaves derivadas) y sin cobrar el límite por comando derivado. | INV + TEST (Zero-Lost-Follow-Up) |
| D6 | Alta | Adjuntos: un reintento con la misma `Idempotency-Key` tras un éxito borra el blob ya confirmado (el evento sigue apuntándolo; descarga 404) y el cliente recibe 409 en vez del replay. Perfil del médico: la ruta fija por tipo+MIME se sobrescribe antes del commit. | Reintento con la misma llave tras un adjunto exitoso: el blob desaparece y el evento lo sigue citando. | Detectar el replay por el id de evento derivado antes de tocar el blob; rutas únicas por subida; nunca borrar una ruta citada por un evento. | TEST |
| D11 | Alta | Cockpit: (a) la vista Signos regenera la llave y el `vitalId` en cada clic y muestra «guardados ✓» aunque el servidor rechace valores; (b) teclear un id en Expediente cambia de paciente sin vaciar las listas del anterior (riesgo de paciente equivocado); (c) acciones que escriben datos inventados en eventos permanentes: lote `L-2026-A` y sitio de la vacuna, firmante «Paciente/Tutor» del consentimiento. | Render jsdom de la vista y lectura de los eventos resultantes. | Comando único por agregado en el cliente; un solo `switchPatient`; toda dato clínico lo escribe el médico. | Autoridad PROD; validación |
| D12 | Alta | (a) Vistas compuestas (`consultation-tabs`, `trends`, `metabolic-panel`) autorizan con `patient:read` y devuelven resultados, órdenes y documentos que sus rutas propias exigen con otro scope (CLINICAL_ADMIN: 403 en `/results`, 200 con valores críticos en Consulta); (b) `/api/v1/timeline` sigue siendo un 503 fijo publicado en la OpenAPI aunque el seguimiento lo da por eliminado; (c) `safeLog` no escribe nada: inicios de sesión, límite de tasa del login y banderas de identidad de desarrollo en producción no dejan rastro; (d) RG-002, RG-003 y C4_C5_INV_WITHOUT_TEST recorren registros vacíos y no pueden fallar; `release/test-execution.json` no tiene generador (146 archivos / 174 tests frente a 230 / 1048). | Sesiones por rol contra las rutas; lectura de los gates. | (a) SPEC_CONFLICT de ADR-0230 → decisión PROD/ENG; (b) retirar la ruta; (c) sumidero de log real; (d) decidir los gates. | Autoridad PROD/ENG y del dueño |
| D7 | Media | En 23 transiciones genéricas la máquina de estados se evalúa sobre la versión leída por el servidor, no sobre el `If-Match`: con un `If-Match` desfasado la respuesta es `CONFLICT "Illegal … transition"` en vez de `CONCURRENCY_CONFLICT {expected,actual}`; bajo concurrencia y un `If-Match` adelantado se persisten transiciones ilegales. | Carrera forzada: alergia INACTIVE→REFUTED; medicación STOPPED→HELD→ACTIVE (una suspensión por reacción adversa vuelve a activa). | Comprobar `expectedVersion===folded.version` tras el replay y antes de la máquina de estados, en un solo sitio (pipeline del lote 11.2). | INV + TEST |
| D9 | Media | `metabolic-panel` devuelve la brecha aniónica corregida por albúmina junto a la advertencia fija «SIN corrección por albúmina». | Respuesta con `albuminCorrected:true` (25; cruda 20) y la advertencia contradictoria. | Advertencia derivada de `albuminCorrected`. | Validación del texto clínico |
| D10 | Media | El indicador de control glucémico del tablero parsea la HbA1c cruda (`'6,5'` → 65; IFCC en mmol/mol contado como no controlado) y cuenta resultados reemplazados. | 4 pacientes controlados: el tablero muestra 25 % contra 100 % real. | Usar el valor canónico y excluir reemplazados. | Autoridad PROD; validación |
| D8 | Baja | Ningún parámetro de ruta se valida: un id que no es UUID produce 500 INTERNAL (22P02) en unas rutas y 200 vacío en otras. | `GET /patients/not-a-uuid/egfr` → 500; `…/timeline` → 200 `{items:[]}`. | Validar el id en el kit de transporte (lote 11.2) y responder 400/404 explícito. | Cambio de contrato (400 en vez de 500) |

## Estado y siguiente paso (al registrar los hallazgos)

- Ninguno se corrige en el refactor. El pipeline del lote 11.2 deja **un solo sitio** donde aplicar D7 y D8, y la partición
  de la persistencia (lote 11.1) deja cada read model afectado (D1, D2, D3) en su propio módulo con el oráculo SQL que hará
  visible el cambio de consulta.
- Prioridad propuesta: D1 y D4 (críticas) antes de cualquier uso asistencial; después D5, D2, D3, D6, D11 y D12.
- Los guiones de reproducción existen como pruebas en vivo desechables del análisis; se incorporan al repositorio como
  pruebas en vivo de regresión junto con cada corrección, que debe hacerlas pasar.

## Estado de las correcciones (2026-09-27)

Cada corrección se hizo en la raíz, con una sola fuente de verdad por regla (la constante o función que el fold o el paquete
de dominio ya poseía, reutilizada por la proyección SQL, el pipeline o la interfaz), su prueba unitaria o de arquitectura y una
prueba en vivo de regresión que **falla contra el código anterior** (control negativo ejecutado en cada caso). Cada lote se
verificó sobre un worktree limpio con exactamente el árbol del commit: typecheck ×3, suite completa, `traceability`, `release`,
`openapi` y `capability`, y todas las pruebas en vivo con los `checks` de las existentes idénticos a la evidencia anterior.

| ID | Commit | Raíz corregida | Prueba en vivo nueva |
|---|---|---|---|
| D1 | `a06e14e` | `VITAL_VOID_KIND` en `vital-fold`; `currentVitalJoins`/`vitalNotVoided` (runtime/sql) en los 3 read models de vitales | `live-vital-correction-proof` (17) |
| D2 | `1813367` | `PATIENT_DEMOGRAPHIC_FIELDS/KINDS` + `patientDemographicsOf` en `patient-fold` (el fold la usa); `patientDemographicsJoin`/`currentPatientName` en SQL (lista, demografía, duplicados y 7 registros) | `live-patient-demographics-projection-proof` (14) |
| D3 | `c72a942` | `DOCUMENT_ANNOTATION_KINDS` en `document-fold`; `lifecycleEventOnly` construido con las listas de anotaciones de cada fold (sin literales) | `live-document-attachment-annotation-proof` (7) |
| D4 | `204e91b` | Lectura tipada `readAggregateStream`; génesis de los 26 folds solo sin `kind`; el kernel rechaza escribir en un stream de otro tipo (`AGGREGATE_TYPE_MISMATCH` → 404) | `live-aggregate-stream-isolation-proof` (9) |
| D5 | `0f7f263` | `runDerivedCommand` (idempotente, sin volver a cobrar el límite); el pipeline ejecuta los derivados también en el replay | `live-derived-command-reconciliation-proof` (5) |
| D6 | `0f7f263` | `priorCommand` reconoce el reintento antes de tocar el Blob; rutas únicas por intento; `blobReferenced` antes de borrar | `live-blob-idempotency-proof` (9) |
| D7 | `ecb9e1c` | `assertReadVersion` en `transitionCommand` (toda transición) y en los handlers manuales; desaparece el opt-in `strictVersion` | `live-optimistic-version-proof` (6) |
| D8 | `ecb9e1c` | `isAggregateId` (forma del tipo uuid de PostgreSQL) en `loadAggregate` y la lectura tipada; `assertRouteIds` del kit de transporte; prueba de arquitectura sobre TODA operación con `*Id` | `live-route-id-validation-proof` (6) |
| D9 | `b6a3ddc` | `anionGapCaveat` en `lab-derivations` | `live-metabolic-panel-caveat-proof` (4) |
| D10 | `a69a0e4` | `A1C_DIABETIC_TARGET_PCT` en `glycemic`; `resultSuperseded` (runtime/sql, sustituye 3 copias); valor canónico en el registro | `live-glycemic-quality-indicator-proof` (5) |
| D11 | `1c949d2` | `submitVitals` + captura estable compartida por Consulta y Signos; `selectPatientRaw` como único cambio de paciente; `ASK` en todo dato que antes se inventaba | pruebas de render D11a–c |
| D12b | `8be73a2` | Ruta stub retirada; OpenAPI regenerada | — |
| D12c | `36034cd` | `safeLog` emite a un sumidero (`setLogSink`) | — |
| D12a | — | **Pendiente de decisión PROD/ENG** (ver abajo) | — |
| D12d | — | **Pendiente de decisión del dueño** (ver abajo) | — |

### Pendiente de decisión

- **D12a — scopes de las vistas compuestas.** ADR-0230 fija scopes por recurso (`<recurso>:read`) pero no dice nada de las
  vistas que agregan varios recursos (`consultation-tabs`, `trends`, `metabolic-panel`). Opciones: (1) exigir el scope de
  lectura de CADA recurso que la vista expone (una sesión sin `result:read` recibe 403 en toda la vista); (2) servir la vista
  con `patient:read` y **omitir** las secciones cuyo scope falta, declarándolas (`"results":{"omitted":"SCOPE"}`).
  Recomendación: (2), porque aplica el mínimo privilegio de ADR-0230 sin romper el flujo de un rol administrativo. Es un
  SPEC_CONFLICT: no se toca hasta que PROD/ENG decida.
- **D12d — gates vacíos y `release/test-execution.json`.** RG-002, RG-003 y C4_C5_INV_WITHOUT_TEST recorren registros vacíos y
  no pueden fallar; el fichero de ejecución no tiene generador. Hacerlos fallar cerrados bloquearía hoy el release (G-03,
  re-línea base de evidencia): decisión del dueño.

### Hallazgos adicionales vistos durante el lote (sin verificar en vivo)

Los reportaron los agentes de migración al clasificar los handlers; se conservaron tal cual porque el refactor preserva el
comportamiento, y quedan registrados para su propio lote:

- `specimen`: el `orderId` opcional se guarda como `""` y no se valida; `regulatory-obligation`: `dueDate` sin formato.
- Signos vitales: la clasificación derivada por el servidor no es estable ante reintentos si cambia la fecha de nacimiento;
  `vitalPlausible`/`classifyVital` ignoran la unidad.
- Carreras (TOCTOU) en el traslape de citas y en la detección de pacientes duplicados.
- `problem`: el evento guarda `codeSystem:"CIE-10 OMS"` y la respuesta dice `"ICD-10"`.
- `office-settings` PUT no tiene replay (un reintento tras un éxito responde 409); el replay de la corrección de un resultado
  omite `corrected` en la respuesta.
