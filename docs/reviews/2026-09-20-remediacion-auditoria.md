# Remediación de la auditoría del 19-sep-2026

Seguimiento de la corrección de los hallazgos de `AUDITORIA_REPO_REAL.md` (auditoría del commit `a537ea5`).
Orden: críticos → altos → medios → bajos. Cada lote se verifica con `pnpm typecheck`, `pnpm typecheck:web`,
`pnpm test`, los gates de autoridad y `pnpm build:web` antes de subirse a `main`.

Los IDs (P-, C-, L-, S-, D-, U-, K-, G-) son los del documento de auditoría.

## Lotes cerrados

| Lote | Commit | Hallazgos | Qué cambió |
|---|---|---|---|
| 0 — Red de seguridad | `4773590` | P-01, P-02, P-03, P-04, P-05, P-11, P-17 | Typecheck estricto en verde (7 errores); `apps/web` compila en modo estricto; una sola workflow de CI con acciones fijadas por SHA; `--frozen-lockfile` en Vercel; fuera de git 15 duplicados " 2" y 3 `tsbuildinfo` |
| 1 — Prescripción: "no evaluado" ≠ "OK" | `5cccd46` | C-03, C-04, C-05, C-14, C-16, U-14 | Evaluador único `packages/prescription-safety` (seis estados por barrera) compartido por PRESCRIBE y el dry-run; 428 `SAFETY_ACK_REQUIRED` con confirmación y justificación del médico, persistidas en el evento; UI en gris para lo no evaluado; la verificación ya no caduca |
| 2 — Verdad clínica en pantalla | `36d382d` | U-01, U-02, U-03, U-05 (parcial), U-11, U-12 (parcial) | Fuera los valores de maqueta que se pintaban como datos del paciente (nombre, edad, sexo, "Alergias (1)", tareas con "Potasio 6.2", agenda y pacientes de ejemplo, "154 plantillas", "234 pacientes"); estado explícito `cargando / listo / error` del expediente con aviso global `role="alert"` y botón Reintentar; al cambiar de paciente se borra de inmediato lo del anterior; test nuevo con el backend caído |
| 3 — Calculadoras: el dato verificado | `1bb018b` | C-01, C-02, C-11, C-12, C-18, U-07; C-19 y C-22 (advertencias) | Sistema de unidades por analito en `packages/lab-reference` (unidad canónica, conversiones SI↔convencional, cotas de plausibilidad, coma decimal, cadena vacía ≠ 0); RECEIVE rechaza unidad desconocida y valor imposible, y persiste `unit / canonicalValue / canonicalUnit / unitAssumed / specimenId`; guarda única `apps/web/lib/analyte-inputs.ts` (faltante · obsoleto · implausible · extracciones distintas) usada por las 9 calculadoras **y** por el panel de inteligencia clínica y la cabecera de consulta; toda calculadora devuelve procedencia (`inputs`) y `algorithm`; gradiente A-a exige FiO₂ explícita; CURB-65 declara la confusión como no evaluada; selector de unidad obligatorio en el formulario de resultados; el mensaje "dentro de rango" solo aparece si el estado es NORMAL; el reintento idempotente de un resultado ya no se compara contra sí mismo |
| 4 — Lazo cerrado y firma | `26a9289` | L-01, L-02, L-03, L-04, K-05, U-06; C-20 (parcial), U-16 (parcial) | **L-01:** el gate de obligaciones se deriva del stream de eventos (`blockingObligations` + función pura `signatureBlockReason`): bloquea lo URGENTE o VENCIDO sin resolver; `clinical_inbox` ya no decide nada; **todo** resultado crítico sin cerrar bloquea (antes solo los ya "accionados"); la vista Seguimiento marca qué tarea bloquea la firma. **L-02:** la hora de firma (encuentro y documento) la pone el servidor; la del cliente queda como dato forense. **L-03:** la firma exige la huella (sha256) del contenido que el médico tiene en pantalla y se rechaza si no coincide con lo guardado; la nota se puede corregir mientras no esté firmada; diálogo de confirmación con el texto persistido; enmienda con texto real del médico; eliminado el "autosave" que devolvía un hash sin guardar. **L-04:** MODIFY/RECONCILE y el estado epistémico/evidencia son *anotaciones* (no cambian el estado); MODIFY y RESUME pasan por el mismo evaluador de seguridad que PRESCRIBE; 5 rutas que no existían; las consultas de "estado por último evento" ignoran anotaciones. **Transversal:** `replayStablePayload` — los valores que pone el servidor son estables ante reintentos idempotentes, y misma llave + petición distinta = conflicto |
| 5 — Verticales hospitalarias tras un flag | `ac83d79` | L-10, L-11 (contención), S-09 (parcial) | `ENABLE_HOSPITAL_VERTICALS` (solo el literal `"true"` enciende; **apagado por defecto**). Apagado: las ~36 rutas de transfusión, cirugía, diálisis, triage, admisión, muestras y heridas responden **404** desde `apps/web/middleware.ts` (antes de autenticar o tocar la base) y la UI no pinta sus 7 paneles (`GET /api/v1/features`, una sola fuente de verdad en el servidor). Verificado por HTTP real con la app construida (apagado 404 · `"true"` llega al handler · `"1"` sigue apagado). Eliminado el árbol heredado `/api/{encounters,patients,results}` (rutas sin autenticación con 501/503 fijos). Test de coherencia: lista ↔ matcher del middleware ↔ carpetas de rutas ↔ paneles de la UI |
| 6a — Borde HTTP | (este commit) | S-03, S-04, S-05 | **S-04:** cabeceras de seguridad en toda respuesta desde `next.config.mjs` (CSP con el IdP como único origen externo, HSTS 2 años, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` porque las rutas llevan ids de paciente, `Permissions-Policy`, COOP/CORP, sin `X-Powered-By`) y `Cache-Control: no-store` + `Pragma: no-cache` en toda la API. La CSP se calcula en **build**: `NEXT_PUBLIC_AUTH0_DOMAIN` debe estar en el entorno de build (verificado en Vercel). **S-03:** límite de tasa con `packages/rate-limit-v2` (que existía sin importadores): login 10 intentos por IP y luego 1 cada 6 s, antes de leer el cuerpo o verificar la credencial; escrituras 120 de golpe y 2/s por **sesión** (no por IP: una clínica comparte IP) en el middleware para toda `/api/v1`; 429 con `Retry-After`. Estado en memoria por instancia (documentado; el tope efectivo escala con el nº de instancias). **S-05:** `apiRequest` fija la `Idempotency-Key` una vez por acción y reintenta con la misma llave y el mismo cuerpo ante fallo de red, 502/503/504 o "comando en curso"; guarda de doble envío (misma acción en vuelo → 409 local, sin compartir la respuesta). Verificado por HTTP real con la app construida |

### Verificación en vivo (desde el lote 3)

Con GitHub Actions bloqueado (P-01), la regresión en vivo se ejecuta contra un **PostgreSQL desechable local**
(`initdb` en un directorio temporal, puerto aparte, `scripts/ci/bootstrap-db.mts` + `scripts/ci/live-smoke.mts`),
nunca contra Neon. Esa corrida destapó que el lote 1 había dejado 10 pruebas en vivo esperando el `201` ciego
de PRESCRIBE: se actualizaron al contrato nuevo (428 → confirmación con justificación → 201; la confirmación
no levanta un bloqueo) y las de calculadoras pasaron a reloj relativo (tenían fecha fija y caducaban solas).

## Acciones que solo puede hacer el dueño del repo

- **P-01:** resolver la facturación / límite de gasto de GitHub Actions. La workflow nueva (`.github/workflows/ci.yml`) está lista, pero Actions no arranca ningún job mientras la cuenta esté bloqueada.
- **P-07:** crear una rama de Neon dedicada a pruebas y definir `TEST_DATABASE_URL` (ver lote correspondiente).
- **G-04:** decidir el uso previsto y la clasificación ScDM por función con asesoría regulatoria.
- **Revisión clínica:** todo cambio de contenido clínico de esta remediación cita su fuente en el código y en los tests, pero debe validarlo un médico antes de uso asistencial.

## Deuda declarada de lotes cerrados

- **Límite de tasa compartido (S-03):** el estado vive en memoria de cada instancia; con N instancias el tope efectivo es
  ~N veces el declarado. Siguiente paso: almacén compartido (tabla en Postgres o KV) tras la misma interfaz `allow(key)`.
- **CSP sin nonces (S-04):** `script-src`/`style-src` llevan `'unsafe-inline'` porque Next arranca con scripts en línea y la
  UI usa atributos `style`. Pasar a nonces exige `middleware` en todas las páginas y `next/script` con nonce; queda para la
  partición de `page.tsx` (punto 9). Aun así la política ya impide scripts de terceros, exfiltración y clickjacking.

- **L-10 / L-11 están CONTENIDOS, no resueltos:** el flag impide que se usen flujos que dan una garantía inexistente. Antes
  de encenderlo hay que construir lo que falta: grupo ABO/Rh del paciente y del hemocomponente con verificación de
  compatibilidad y doble verificación a pie de cama (transfusión); lista de verificación OMS con participantes, sitio,
  procedimiento y alergias (time-out quirúrgico); y revisión clínica de cada vertical. Encenderlo es una decisión del dueño.
- **`packages/authz`** (duplicado de `runtime-auth` que lanza `Error` plano, S-09) sigue existiendo porque
  `packages/http-principal` importa su tipo `Principal`; se retira en la limpieza de paquetes (punto 10).

- **Resultados corregidos / anulados (parte de C-02):** el ciclo de vida de resultados no tiene todavía una transición
  de corrección o anulación, así que las calculadoras no pueden excluirlos. Requiere diseñar el evento (¿quién anula?, ¿qué
  pasa con las obligaciones derivadas?) con criterio clínico; queda para el punto 8 del pendiente.
- **Obligación automática ante resultado crítico (C-20):** hoy el crítico bloquea la firma por sí mismo hasta cerrarse; no
  se crea además una obligación con responsable y fecha. Entra con el punto 8 del pendiente.
- **Conciliación de medicación** (`handleMedicationReconciliation`) sigue sin ruta: es un concepto hospitalario
  (ingreso/alta/traslado) y se decide junto con las verticales hospitalarias (punto 4 del pendiente).
- **Edición de borradores de documento:** el contenido es inmutable desde la creación (no hay evento `DOCUMENT_REVISED`).
  Si se quiere editar borradores, se añade ese evento al fold; no un autoguardado simulado.
- **Criterio del gate de firma** (URGENTE o VENCIDA bloquean; futura de rutina no) es una decisión de producto tomada
  aquí con su razón en `packages/obligation-fold`; conviene que la valide un médico.
- **Vigencia de signos vitales:** `latestVitalsByType` no entrega la fecha de la toma; CURB-65, NEWS2 y el IMC aún no
  caducan un signo vital viejo. Entra con el punto 8 del pendiente (C-09, C-13).
- **Vigencias y ventanas** (`MAX_AGE_DAYS`, `COHERENCE_HOURS`) y **cotas de plausibilidad** son criterio conservador de
  ingeniería con su razón en el código: requieren validación de un médico.
- **LDL y UACR** no tienen aún especificación de unidad ni rango; se muestran sin pasar por la guarda.
- **"1 tab" como dosis:** el techo diario no es verificable sin la concentración de la presentación; hoy exige
  confirmación del médico. Derivar los mg del `drugCode` entra con C-15.

## Pendiente (en orden)

5. Seguridad de borde: cabeceras, `no-store`, límite de tasa, idempotencia estable en el cliente, scopes de lectura (S-01…S-05).
6. Base de datos: RLS en `audit_ledger`/`idempotency_keys`, tablas en denegación total, colisiones de esquema, `db:migrate` (D-01, D-04, D-05, D-08, P-06).
7. Pruebas en vivo: `TEST_DATABASE_URL` obligatorio y guarda contra producción (P-07).
8. Contenido clínico: Charlson completo, NEWS2 escala 2, PA con hipotensión, vitales y vacunación por edad, alergias por clase, tabla única de interacciones, CIE-10 OMS (C-06…C-10, C-13, C-17…C-22, U-13).
9. Resto de UI (cambio de paciente, confirmación de firma, motivos clínicos reales, afirmaciones de cumplimiento) (U-04…U-20).
10. Limpieza, paquetes muertos, ADRs, documentación y registro normativo (K-, G-, P-14…P-17).
