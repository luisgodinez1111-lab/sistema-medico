-- FUENTE ÚNICA DE VERDAD de los roles de base de datos.
--
-- Auditoría 2026-09-19, anexo R06 (R06-15): los roles se creaban en DOS sitios con atributos distintos — este fichero
-- (runtime y worker, con los calificadores explícitos, incluido NOINHERIT) y la migración 0016 (los tres, sin
-- calificadores, así que `medical_os_readonly` quedaba con el INHERIT por omisión de Postgres). Como el bootstrap y el
-- restore drill aplican ESTE fichero ANTES de las migraciones, la rama CREATE ROLE de 0016 nunca se ejecuta en la práctica:
-- era código muerto que, además, discrepaba. Las migraciones aplicadas no se editan (regla D-07), así que 0016 se queda
-- como está y este fichero pasa a declarar los TRES roles con los MISMOS atributos. Un test compara las dos listas y falla
-- si divergen otra vez.
--
-- Por qué los calificadores importan:
--   · NOBYPASSRLS — sin él, el rol se saltaría TODA política de aislamiento por tenant. Es el atributo que sostiene el RLS.
--   · NOSUPERUSER, NOCREATEDB, NOCREATEROLE — mínimo privilegio: ninguno de los tres roles administra el clúster.
--   · NOINHERIT — el rol no usa automáticamente los privilegios de los roles de los que sea miembro: para usarlos hay un
--     SET ROLE explícito. Sin esto, añadir mañana una pertenencia a un grupo ampliaría el acceso en silencio.
--
-- Reparto de privilegios (migraciones 0017, 0018 y 0026):
--   · medical_os_runtime  — la aplicación: las tablas que usa, con SELECT/INSERT/UPDATE según el caso.
--   · medical_os_worker   — el consumidor del outbox (aún no construido: D-03/R06-27): lo mínimo para drenar y anotar.
--   · medical_os_readonly — SELECT sobre las tablas con RLS; el aislamiento por tenant lo sigue imponiendo la política.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='medical_os_runtime')  THEN CREATE ROLE medical_os_runtime  LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='medical_os_worker')   THEN CREATE ROLE medical_os_worker   LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='medical_os_readonly') THEN CREATE ROLE medical_os_readonly LOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF;
 -- Los roles ya existentes (creados por 0016 sin calificadores) se alinean: el atributo que importa es NOINHERIT, que
 -- Postgres deja en INHERIT por omisión.
 ALTER ROLE medical_os_runtime  NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
 ALTER ROLE medical_os_worker   NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
 ALTER ROLE medical_os_readonly NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
END $$;
