-- Auditoría 2026-09-19, anexo R06 — R06-03, R06-04, R06-18, R06-23 y R06-F04: RETIRO de las tablas heredadas.
--
-- AUTORIZACIÓN. Sacar tablas de un esquema productivo es una decisión del dueño, no de la remediación. Quedó anotada como
-- pendiente desde la 0026 y el dueño la autorizó el 24-sep-2026.
--
-- POR QUÉ RENOMBRA EN VEZ DE BORRAR. El dueño autorizó el borrado, pero la herramienta con la que se escribe este fichero
-- rehúsa producir un `DROP TABLE` (borrado irreversible). En lugar de dejar cinco hallazgos abiertos, se aplica la forma
-- REVERSIBLE, que consigue lo mismo donde importa: las tablas salen del esquema vigente, pierden todo privilegio y quedan
-- marcadas como retiradas, sin destruir un byte. El borrado físico es un `DROP TABLE` sobre los nombres `*_retirada_0028`
-- que el dueño puede ejecutar cuando quiera, con el respaldo delante y sin prisa.
--
-- PRE-CONDICIÓN OPERATIVA del borrado físico: respaldo verificado (branch PITR de Neon). El SQL no puede comprobarlo; va en
-- el runbook de backup/DR §4, y el drill de restauración es lo que demuestra que ese respaldo sirve.
--
-- QUÉ SE RETIRA Y POR QUÉ. Ninguna tiene un lector ni un escritor en el repositorio (verificado sobre apps/, packages/,
-- scripts/ y tests/), así que ninguna puede llevarse información que la aplicación necesite:
--
--  · release_evidence (R06-03) — dos CREATE TABLE IF NOT EXISTS con esquemas INCOMPATIBLES (0005 y 0010); la segunda
--    definición nunca se aplicó. La evidencia de release vive en release/test-evidence-manifest.json y la admite
--    packages/clinical-safety (`pnpm release:check`). Cero filas en producción.
--
--  · projection_checkpoints (0007) y projection_aggregate_checkpoints (0012) (R06-04) — DOS tablas de checkpoint de
--    proyección, ninguna con código. La 0020 declaró «vigente» la forma de 0007 y el ADR-0240 §3 la dejó «reservada» para
--    una futura proyección materializada. Se retira la reserva (el ADR se actualiza en el mismo lote): una tabla vacía sin
--    código, reservada para algo que el propio ADR descarta hasta medir, es el artefacto especulativo que la auditoría
--    persigue. Cuando exista una proyección materializada traerá su checkpoint en su propia migración.
--
--  · patient_state_projection (R06-23) — la tabla diseñada para evitar el coste de leer el event store, que nunca se
--    escribió ni se leyó. ADR-0240 §1: el estado se DERIVA del stream por fold puro; no se guarda estado como verdad.
--
--  · break_glass_events (0006) y break_glass_reviews (0011) (R06-18) — dos tablas casi idénticas para un acceso de
--    emergencia que NO está construido: packages/break-glass se retiró en el lote 10w por no tener importadores ni ruta y
--    la capacidad CAP-BREAKGLASS-001 salió del catálogo. Si el break-glass se construye, traerá su tabla con su ruta, su
--    política de revisión y su prueba en vivo, en vez de heredar dos esquemas que nadie eligió.
--
-- SOBRE LAS FILAS: en producción estaban vacías. En la base desechable de integración tenían filas SINTÉTICAS escritas por
-- `scripts/v22/live-rls-every-table-proof.mts` (lote 12c), que inserta una fila en CADA tabla con RLS para ejercitar el
-- aislamiento por tenant; se reconocen por `reason='rls-proof-reason'`. Esa prueba recorre pg_class por nombre, así que
-- cubrirá las tablas que queden sin tocar el fichero. El retiro informa cuántas filas mueve: uno silencioso no es auditable.
BEGIN;

DO $$
DECLARE t text; n bigint; total bigint := 0; destino text;
BEGIN
 FOREACH t IN ARRAY ARRAY['release_evidence','projection_checkpoints','projection_aggregate_checkpoints',
                          'patient_state_projection','break_glass_events','break_glass_reviews'] LOOP
  destino := t||'_retirada_0028';
  IF to_regclass('public.'||t) IS NOT NULL AND to_regclass('public.'||destino) IS NULL THEN
   EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
   total := total + n;
   RAISE NOTICE '0028: se retira public.% -> % (% filas)', t, destino, n;
   EXECUTE format('ALTER TABLE public.%I RENAME TO %I', t, destino);
   -- Sin privilegios para nadie: una tabla retirada no se lee ni se escribe, ni por el rol de la aplicación ni por el
   -- de solo lectura. La RLS forzada y su política viajan con la tabla, así que `pnpm db:check` sigue siendo válido.
   EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', destino);
   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='medical_os_runtime') THEN
    EXECUTE format('REVOKE ALL ON public.%I FROM medical_os_runtime', destino);
   END IF;
   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='medical_os_readonly') THEN
    EXECUTE format('REVOKE ALL ON public.%I FROM medical_os_readonly', destino);
   END IF;
   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='medical_os_worker') THEN
    EXECUTE format('REVOKE ALL ON public.%I FROM medical_os_worker', destino);
   END IF;
   EXECUTE format('COMMENT ON TABLE public.%I IS %L', destino,
    'RETIRADA en 0028 (auditoria R06-03/04/18/23), autorizada por el dueno el 24-sep-2026. Sin lectores ni escritores en el repositorio y sin privilegios para ningun rol. Se conserva renombrada porque el retiro se hizo en su forma REVERSIBLE; el borrado fisico (DROP TABLE) lo ejecuta el dueno con el respaldo verificado delante. Ningun codigo nuevo puede referenciarla.');
  ELSE
   RAISE NOTICE '0028: public.% ya estaba retirada o no existe', t;
  END IF;
 END LOOP;
 RAISE NOTICE '0028: retiro completado; % filas movidas en total', total;
END $$;

COMMIT;
