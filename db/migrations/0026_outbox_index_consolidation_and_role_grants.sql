-- Auditoría 2026-09-19, anexo R06 — R06-12 y R06-10.
--
-- (El retiro de las cuatro tablas heredadas —R06-03 release_evidence, R06-04 projection_checkpoints, R06-23
--  patient_state_projection y R06-18 break_glass_events— NO está en esta migración: borrar tablas de un esquema productivo
--  es una decisión del dueño, no de la remediación. Quedan aisladas y documentadas desde 0020, y el retiro está anotado
--  como pendiente de autorización en el tracker.)
BEGIN;

-- ---------- R06-12: consolidación de los índices del outbox ----------
-- La tabla acumulaba CUATRO índices de «claim» de iteraciones distintas (0001, 0003, 0012 y 0014), parcheada en cinco
-- migraciones. Y al mirar la consulta real apareció algo que el anexo no había medido: NINGUNO de los cuatro sirve para
-- ella. El claim (`packages/outbox-claim-v2`) ordena por `COALESCE(available_at,next_attempt_at,created_at), id`, una
-- EXPRESIÓN, y un índice sobre las columnas por separado no la cubre. Cuatro índices que se mantienen en cada escritura de
-- la cola —y el kernel escribe en outbox en TODOS los comandos— para una consulta que igualmente hacía sort.
-- Se retiran los tres obsoletos, se crea el que corresponde a la consulta vigente y se conserva outbox_fencing_claim_idx,
-- que es el que sostiene la prueba de fencing (0014).
DROP INDEX IF EXISTS outbox_claim_idx;      -- 0003: (state,next_attempt_at,created_at)
DROP INDEX IF EXISTS outbox_delivery_idx;   -- 0001: (state,next_attempt_at)
DROP INDEX IF EXISTS outbox_claim_v16_idx;  -- 0012: (state,available_at,locked_until,id)
CREATE INDEX IF NOT EXISTS outbox_claim_ready_idx
  ON outbox (state, (COALESCE(available_at,next_attempt_at,created_at)), id)
  WHERE state IN ('PENDING','RETRY');
COMMENT ON INDEX outbox_claim_ready_idx IS 'Indice VIGENTE del claim del outbox: cubre la expresion de orden de CLAIM_SQL (COALESCE(available_at,next_attempt_at,created_at), id). Auditoria R06-12.';
COMMENT ON TABLE outbox IS 'Cola transaccional de eventos. Indice de claim vigente: outbox_claim_ready_idx (0026). El worker consumidor es decision del dueno (D-03, R06-27): medical_os_worker ya tiene los privilegios minimos.';

-- ---------- R06-10: privilegios de los roles que no tenían ninguno ----------
-- `medical_os_runtime` tenía grants sobre las tablas que usa (correcto: mínimo privilegio). Pero `medical_os_readonly` y
-- `medical_os_worker` existían SIN un solo privilegio de tabla: un rol sin privilegios no es «restringido», es inservible,
-- y su existencia sugiere una separación de funciones que en realidad no existía.
--   · readonly: SELECT sobre las tablas con RLS. El aislamiento por tenant lo sigue imponiendo la política (el rol NO
--     tiene BYPASSRLS), así que leer sin contexto de tenant no devuelve ninguna fila.
--   · worker: lo mínimo para drenar la cola y anotar el recibo del consumidor. El worker real es decisión del dueño
--     (D-03 / R06-27): esto le da los privilegios exactos que necesitaría, ni uno más.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
           WHERE ns.nspname='public' AND c.relkind='r' AND c.relrowsecurity ORDER BY 1 LOOP
    EXECUTE format('GRANT SELECT ON %I TO medical_os_readonly',t);
  END LOOP;
END $$;
GRANT SELECT, UPDATE ON outbox TO medical_os_worker;
GRANT SELECT, INSERT ON outbox_consumer_receipts TO medical_os_worker;
GRANT SELECT ON clinical_events TO medical_os_worker;

COMMIT;
