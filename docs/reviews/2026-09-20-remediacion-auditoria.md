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
| 4 — Lazo cerrado y firma | (este commit) | L-01, L-02, L-03, L-04, K-05, U-06; C-20 (parcial), U-16 (parcial) | **L-01:** el gate de obligaciones se deriva del stream de eventos (`blockingObligations` + función pura `signatureBlockReason`): bloquea lo URGENTE o VENCIDO sin resolver; `clinical_inbox` ya no decide nada; **todo** resultado crítico sin cerrar bloquea (antes solo los ya "accionados"); la vista Seguimiento marca qué tarea bloquea la firma. **L-02:** la hora de firma (encuentro y documento) la pone el servidor; la del cliente queda como dato forense. **L-03:** la firma exige la huella (sha256) del contenido que el médico tiene en pantalla y se rechaza si no coincide con lo guardado; la nota se puede corregir mientras no esté firmada; diálogo de confirmación con el texto persistido; enmienda con texto real del médico; eliminado el "autosave" que devolvía un hash sin guardar. **L-04:** MODIFY/RECONCILE y el estado epistémico/evidencia son *anotaciones* (no cambian el estado); MODIFY y RESUME pasan por el mismo evaluador de seguridad que PRESCRIBE; 5 rutas que no existían; las consultas de "estado por último evento" ignoran anotaciones. **Transversal:** `replayStablePayload` — los valores que pone el servidor son estables ante reintentos idempotentes, y misma llave + petición distinta = conflicto |

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

4. Verticales hospitalarias tras `ENABLE_HOSPITAL_VERTICALS` (apagado por defecto) (L-10, L-11).
5. Seguridad de borde: cabeceras, `no-store`, límite de tasa, idempotencia estable en el cliente, scopes de lectura (S-01…S-05).
6. Base de datos: RLS en `audit_ledger`/`idempotency_keys`, tablas en denegación total, colisiones de esquema, `db:migrate` (D-01, D-04, D-05, D-08, P-06).
7. Pruebas en vivo: `TEST_DATABASE_URL` obligatorio y guarda contra producción (P-07).
8. Contenido clínico: Charlson completo, NEWS2 escala 2, PA con hipotensión, vitales y vacunación por edad, alergias por clase, tabla única de interacciones, CIE-10 OMS (C-06…C-10, C-13, C-17…C-22, U-13).
9. Resto de UI (cambio de paciente, confirmación de firma, motivos clínicos reales, afirmaciones de cumplimiento) (U-04…U-20).
10. Limpieza, paquetes muertos, ADRs, documentación y registro normativo (K-, G-, P-14…P-17).
