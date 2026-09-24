-- Auditoría 2026-09-19, anexo R06 — R06-F11 y R06-18.
--
-- R06-F11: «no hay documentación que declare cuál de las versiones duplicadas de cada paquete/tabla es la vigente». Para
-- las tablas, la 0020 ya lo declaró con COMMENT ON TABLE en cuatro casos (audit_ledger, idempotency_keys, release_evidence,
-- projection_checkpoints) y la 0026 en el outbox. Faltaban CINCO, y son justo las que un lector encontraría primero al
-- mirar el esquema sin contexto: dos pares con nombres casi iguales y una proyección que nadie escribe.
--
-- Esta migración NO cambia estructura ni datos: solo escribe en el catálogo la autoridad de cada una, donde el siguiente
-- que abra la base la vea. El retiro (DROP) de las que están muertas sigue siendo decisión del dueño (ADR-0240 §4, D-09).
BEGIN;

-- ---------- R06-18: los dos «break glass» ----------
-- Dos tablas casi idénticas para el acceso de emergencia, creadas en iteraciones distintas y ninguna con código:
-- `packages/break-glass` se retiró en el lote 10w por no tener importadores ni ruta. Si la funcionalidad se construye, la
-- base es break_glass_events: ya trae las columnas de la revisión (reviewed_by / reviewed_at), es la que la 0020 puso en
-- denegación total y la que el modelo de amenazas nombra. break_glass_reviews solo añade `review_status`, que es derivable
-- (reviewed_at nulo = PENDIENTE), y le falta reviewed_at.
COMMENT ON TABLE break_glass_events  IS 'LEGADO SIN CONSUMIDOR (auditoria R06-18): el acceso de emergencia NO esta construido (packages/break-glass se retiro en el lote 10w por no tener importadores ni ruta). Si se construye, ESTA es la tabla base: incluye la revision (reviewed_by, reviewed_at) y esta en denegacion total desde 0020. Retirada o implementacion: decision del dueno (ADR-0240 §4).';
COMMENT ON TABLE break_glass_reviews IS 'DUPLICADO DE break_glass_events (auditoria R06-18), creada en 0011 en una iteracion posterior y tambien sin consumidor. No es la fuente de verdad: solo agrega review_status (derivable de reviewed_at) y le falta reviewed_at. Ningun codigo nuevo puede leerla ni escribirla.';

-- ---------- R06-F11: los dos «recibos del consumidor» ----------
-- La vigente es outbox_consumer_receipts: es la que nombra ADR-0031, la que lleva el `fencing_token` del que depende la
-- garantía de exactly-once del claim (packages/outbox-claim-v2 + outbox_fencing_claim_idx de 0014) y la única con
-- privilegios para medical_os_worker (0026). consumer_receipts no tiene fencing token, así que no puede expresar esa
-- invariante ni con datos correctos.
COMMENT ON TABLE outbox_consumer_receipts IS 'VIGENTE (auditoria R06-F11): recibo del consumidor del outbox. Lleva fencing_token, del que depende la garantia de procesado unico del claim (packages/outbox-claim-v2, indice de 0014), y es la unica con privilegios para medical_os_worker (0026). El worker consumidor real sigue siendo decision del dueno (D-03, R06-27).';
COMMENT ON TABLE consumer_receipts        IS 'LEGADO (auditoria R06-F11): primera version del recibo del consumidor (0008), SIN fencing_token, por lo que no puede expresar el procesado unico. Sustituida por outbox_consumer_receipts (0011). Sin lectores ni escritores. Retirada pendiente de decision del dueno (ADR-0240 §4).';

-- ---------- R06-23: la proyección que nadie escribe ----------
-- La tabla existe para evitar el coste de lectura del event store, y ADR-0240 §3 descartó explícitamente introducir
-- proyecciones materializadas hasta medir: la verdad se deriva del stream por fold. Queda declarada como no utilizable.
COMMENT ON TABLE patient_state_projection IS 'NO SE USA (auditoria R06-23): ni un escritor ni un lector en todo el repositorio. ADR-0240 §3 descarta las proyecciones materializadas hasta medir: el estado del paciente se deriva del stream por fold puro. En denegacion total desde 0020. Su retirada es decision del dueno (ADR-0240 §4, D-09); ningun codigo nuevo puede usarla.';

COMMIT;
