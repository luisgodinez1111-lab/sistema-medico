# ADR-0280 — Retención y borrado de PHI en un expediente append-only (LFPDPPP / NOM-004)
Status: PROPUESTO (2026-09-22) — auditoría D-09. Diseño listo; la ejecución del borrado exige decisiones del dueño (§Decisiones pendientes).

## Contexto

La UI afirmaba cumplimiento de la LFPDPPP sin que existiera mecanismo alguno de retención o borrado (D-09). El expediente es
un stream de eventos inmutables (`clinical_events`, ADR-0240) encadenado a una auditoría append-only (`audit_chain_v3`) cuyo
rol de aplicación no puede modificar ni borrar nada. Dos obligaciones legales tiran en sentidos opuestos:

- **NOM-004-SSA3-2012 (5.4):** el expediente clínico se conserva **al menos 5 años** contados desde el último acto médico.
- **LFPDPPP (arts. 22–26, derechos ARCO) y su Reglamento:** el titular puede pedir **acceso, rectificación, cancelación y
  oposición**; la cancelación produce un periodo de **bloqueo** y después la supresión, salvo que una obligación legal exija
  conservar (el propio expediente durante su plazo).

## Decisión (diseño)

1. **Reloj de retención por paciente** = fecha del último acto clínico registrado (evento más reciente de cualquier agregado
   del paciente). Retención mínima: 5 años (NOM-004); el tenant puede fijar un plazo mayor (ajuste `retentionYears` en la
   configuración del consultorio, nunca menor que el legal).
2. **Derechos ARCO sobre lo que ya existe:** acceso = exportación del expediente (`GET /patients/:id/export`, manifiesto con
   hash reproducible); rectificación = enmiendas (eventos `AMENDED`, nunca edición del original); oposición/cancelación =
   evento `PATIENT_ERASURE_REQUESTED` (anotación del agregado Paciente con fecha, quién lo recibió y el fundamento) que
   **bloquea** el uso no asistencial del expediente y arranca el plazo de supresión al vencer la retención.
3. **Supresión = criptoborrado + purga**, no `DELETE` a ciegas:
   - objetivo: cifrar el `payload` de los eventos con una clave por paciente (envelope encryption); borrar la clave hace
     ilegible la PHI sin romper la cadena de auditoría (las huellas se calcularon sobre el texto cifrado). Hasta que exista
     el cifrado por paciente, la purga física de `clinical_events` del paciente y el **anulado** del `payload` de sus
     entradas en `audit_chain_v3` (conservando `entry_hash`/`previous_hash`, que prueban que la entrada existió) es la única
     vía; deja la cadena verificable en enlace pero no en contenido para esas entradas, y así debe declararlo el verificador.
   - la purga la ejecuta el **operador con el rol propietario del esquema**, nunca la aplicación:
     `pnpm phi:retention` informa (solo lectura) qué pacientes superaron la retención y cuáles tienen solicitud de
     cancelación; la purga física queda detrás de `--purge --yes` + `PHI_PURGE_ALLOW=1` y de las decisiones de abajo.
4. **Copias y adjuntos:** los binarios de Vercel Blob y los respaldos (Neon) tienen su propia retención; la purga debe
   propagarse a ellos y registrarse (evento `PATIENT_ERASED` con el recuento de lo suprimido, sin PHI).
5. **Auditoría de lecturas:** quién consultó o exportó un expediente (y quién imprimió una receta) se registrará en la cadena
   de auditoría como acción `READ`/`EXPORT` sin payload clínico; hoy no existe y es prerrequisito para responder a un
   derecho de acceso completo.

## Decisiones pendientes del dueño

- Plazo de retención por defecto por encima del mínimo legal y quién puede modificarlo.
- Cifrado por paciente (criptoborrado) vs. purga física con anulado de payloads de auditoría, y desde qué migración.
- Tratamiento de menores (la retención cuenta desde la mayoría de edad en varias interpretaciones) y de fallecidos.
- Procedimiento de atención ARCO (plazos de 20 días de respuesta y 15 de ejecución; responsable designado; aviso de privacidad).

## Alternativas consideradas

1. **Borrado físico de los eventos del paciente (`DELETE`).** Es lo que una lectura literal del derecho de cancelación
   sugiere, y se descartó porque rompe la **cadena de auditoría append-only**: borrar un evento invalida el hash de todos
   los posteriores y destruye la propiedad que hace verificable el expediente. Además choca con la retención mínima de
   cinco años (NOM-004), que es una obligación, no una opción.
2. **No hacer nada y declarar que la retención legal lo exime todo.** Se descartó porque la LFPDPPP concede derechos que
   la NOM-004 no suspende: lo que procede es **acotar el ejercicio**, no negarlo.
3. **Criptoborrado por paciente (clave por paciente, se destruye la clave).** Es la opción que este ADR deja **abierta
   para el dueño**, no descartada: cumple el derecho sin romper la cadena, pero exige decidir dónde viven las claves y
   quién las custodia, y esa decisión no es de ingeniería.

## Consecuencias

- Mientras esta decisión esté PROPUESTA, la UI no afirma cumplimiento de la LFPDPPP (U-18 ya retiró esas afirmaciones) y
  el informe de retención es solo lectura.
- Toda purga futura queda registrada como evento sin PHI y es verificable en la cadena.
