-- Auditoría 2026-09-19, anexos R06 y R09 — R06-06 y R06-F06 (no existe tabla `tenants`), R06-27, R06-F16 y R09-002 (el
-- outbox no tiene consumidor).
--
-- LOS DOS HALLAZGOS SON LA MISMA CADENA, y se ve al intentar construir el worker que ADR-0031 prometía:
--
--   1. Todos los comandos clínicos insertan en `outbox` con estado PENDING, y NADA la drena. El rol `medical_os_worker`
--      existe desde la 0016 con `SELECT, UPDATE` sobre `outbox` —el permiso estaba— y `db/roles_v16.sql` lo dice sin
--      rodeos: «el consumidor del outbox (aún no construido)».
--   2. El worker es `NOBYPASSRLS` y la política de `outbox` es `tenant_id = app.current_tenant()` FORZADA. Eso es correcto
--      —el aislamiento no se relaja para un proceso de fondo—, pero implica que para drenar hay que declarar de qué tenant,
--      y para recorrer todos hay que poder ENUMERARLOS. No había forma: `tenant_id` es un uuid que no referencia nada y no
--      existía una tabla de tenants. El hallazgo R06-06 («cero REFERENCES; tampoco existe una tabla `tenants`») no era una
--      observación de estilo: era lo que impedía construir el worker.
--
-- QUÉ HACE ESTA MIGRACIÓN
--   · Crea `tenants`, el registro de consultorios: el destino que `tenant_id` nunca tuvo. NO lleva PHI (nombre del
--     consultorio y estado), y NO lleva RLS: es la tabla que hay que poder leer ANTES de saber en qué tenant se está, así
--     que una política sobre `app.current_tenant()` la haría inservible para su único propósito. Se protege con privilegios:
--     el worker y el runtime solo leen.
--   · La rellena con los tenants que YA existen en el event store, para no inventar un registro vacío junto a datos vivos.
--   · Da al worker lo que le falta para anotar recibos y deja constancia de que el claim (`outbox-claim-v2`) ya es válido
--     contra este esquema: `state='LEASED'` está admitido por el CHECK desde la 0012 y `max_attempts` existe desde la 0008.
--
-- LO QUE NO HACE, y por qué. NO añade `REFERENCES tenants(id)` a las 33 tablas con `tenant_id`. Hacerlo es correcto en el
-- fondo, pero es una migración que toca todo el esquema productivo y debe ir con su ventana y su respaldo; queda propuesta
-- con el detalle en el rastreador, para el dueño. Lo que esta migración sí consigue es que la referencia TENGA un destino,
-- que es el requisito previo. Sin `tenants` no hay a qué referenciar.

CREATE TABLE IF NOT EXISTS tenants (
 id uuid PRIMARY KEY,
 name text NOT NULL DEFAULT '',
 -- ACTIVE: opera. SUSPENDED: no debe drenarse ni atenderse. ARCHIVED: histórico conservado, sin operación.
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED','ARCHIVED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 -- Momento del último drenado con éxito. Lo escribe el worker; sirve para ver si un tenant se quedó sin drenar.
 outbox_drained_at timestamptz
);
COMMENT ON TABLE tenants IS
 'Registro de tenants (consultorios). Sin PHI y SIN RLS a propósito: es la tabla que hay que leer ANTES de saber en qué tenant se está, y una política sobre app.current_tenant() la haría inservible para enumerar. Se protege por privilegios. Auditoría R06-06: da destino al tenant_id que no referenciaba nada, y es el requisito previo del worker del outbox (R06-27).';

-- Relleno desde lo que ya existe: los tenants que el event store demuestra. Un registro vacío al lado de datos vivos sería
-- peor que no tenerlo, porque el worker no vería nada y parecería que no hay trabajo.
INSERT INTO tenants(id,name)
 SELECT DISTINCT tenant_id,'' FROM clinical_events
 ON CONFLICT (id) DO NOTHING;

-- Privilegios. El worker LEE el registro (para saber a quién drenar) y ACTUALIZA solo su marca de drenado; el runtime lo lee.
-- Nadie inserta ni borra desde la aplicación: dar de alta un consultorio es una operación administrativa, no una ruta.
GRANT SELECT ON tenants TO medical_os_runtime, medical_os_worker, medical_os_readonly;
GRANT UPDATE (outbox_drained_at) ON tenants TO medical_os_worker;

-- R06-F16: el worker ya podía reclamar (SELECT+UPDATE en outbox desde la 0017/0026); lo que le faltaba era poder anotar el
-- recibo que hace idempotente la entrega, y leerlo para no entregar dos veces.
GRANT SELECT, INSERT ON outbox_consumer_receipts TO medical_os_worker;

CREATE INDEX IF NOT EXISTS tenants_active_idx ON tenants(status) WHERE status='ACTIVE';
