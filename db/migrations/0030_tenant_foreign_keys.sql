-- Auditoría 2026-09-19, anexo R06 — R06-06 y R06-F06: «cero REFERENCES/FOREIGN KEY», marcado como «SIGUE, 100 %».
--
-- MEDIDO el 05-oct-2026 antes de escribir una línea: 33 tablas vigentes llevan `tenant_id` y el esquema tiene
-- **cero** claves foráneas. La 0029 creó `tenants`, que es el destino que esa columna nunca tuvo. Esta migración cierra el
-- círculo: la referencia existe y se valida.
--
-- QUÉ COMPRA ESTA CLAVE FORÁNEA, Y QUÉ NO. Compra INTEGRIDAD REFERENCIAL: a partir de aquí no puede existir una fila con un
-- `tenant_id` que no corresponda a un consultorio registrado, y por tanto la enumeración de tenants —de la que depende el
-- drenado del outbox (R06-27)— es completa por construcción, no por confianza. NO compra autorización: no decide QUIÉN puede
-- ser un tenant. Hoy eso lo decide el IdP, porque el `tenant_id` viene de un claim (`OIDC_TENANT_CLAIM`) y el primer
-- `INSERT` crea de hecho el consultorio. Conflatar las dos cosas sería el error: una clave foránea no es un control de
-- acceso. La decisión «un tenant debe estar dado de alta explícitamente y una sesión de un tenant no registrado se rechaza»
-- es del dueño y está anotada en el rastreador; lo que esta migración hace es dejar el esquema listo para sostenerla.
--
-- POR QUÉ `NOT VALID` Y LUEGO `VALIDATE`, y no un `ADD CONSTRAINT` directo. Un `ADD CONSTRAINT` con validación inmediata
-- toma un ACCESS EXCLUSIVE sobre la tabla durante todo el escaneo: en `clinical_events` eso es bloquear el expediente entero
-- mientras dura. `NOT VALID` lo añade sin escanear (bloqueo breve) y `VALIDATE CONSTRAINT` hace el escaneo con un
-- SHARE UPDATE EXCLUSIVE, que NO bloquea lecturas ni escrituras. Es la diferencia entre una ventana de mantenimiento y una
-- migración que se puede aplicar con el consultorio trabajando.
--
-- POR QUÉ SIN `ON DELETE CASCADE`. El comportamiento por omisión (`NO ACTION`) es el correcto y es deliberado: si alguien
-- intenta borrar un consultorio que todavía tiene expediente, la base lo IMPIDE. Un `CASCADE` convertiría un `DELETE` de una
-- fila administrativa en el borrado silencioso de todo el expediente clínico de ese consultorio, que es exactamente lo que
-- un sistema con retención legal de cinco años (NOM-004) no debe permitir que ocurra por accidente. El borrado de PHI tiene
-- su propio procedimiento (ADR-0280) y no pasa por aquí.

-- QUÉ TABLAS QUEDAN FUERA, Y POR QUÉ. Tres tablas con `tenant_id` NO reciben la clave foránea, y la razón es la misma en las
-- tres: registran INTENTOS, no datos del consultorio. Lo descubrieron las pruebas en vivo al fallar con la restricción puesta:
--
--   · `phi_access_log` — auditoría de LECTURAS de PHI: quién accedió a qué expediente y con qué propósito. Un acceso puede
--     venir de un tenant que nunca ha escrito nada, y ése es precisamente el acceso que más interesa auditar. Con la clave
--     foránea, el INSERT del registro fallaría y el sistema NO PODRÍA ANOTAR el acceso sospechoso: la integridad referencial
--     se habría comprado al precio de suprimir la auditoría del caso que importa. Es inaceptable y por eso se excluye.
--   · `session_revocations` — lista de denegación de sesiones. Revocar la sesión de un tenant que no escribió nunca tiene que
--     poder hacerse: es una operación de seguridad, y bloquearla por una restricción de integridad sería dejar viva una sesión
--     que alguien quiso cortar.
--   · `access_decisions` — registro de decisiones de acceso, incluidas las DENEGADAS. Mismo argumento que el log de PHI.
--
-- Las tres son append-only para la aplicación y no contienen datos clínicos del consultorio, así que la integridad que la
-- clave foránea aporta en las otras 30 no es la propiedad que estas necesitan. Se declara aquí para que la exclusión sea una
-- decisión visible y no un olvido.

-- ---------- 1) RELLENO COMPLETO, sobre todas las tablas con `tenant_id` ----------
-- La 0029 rellenó desde `clinical_events`, que es donde están los tenants con actividad clínica. Pero hay tablas que pueden
-- tener un `tenant_id` sin evento clínico asociado —revocaciones de sesión, registro de accesos a PHI, cubos de límite de
-- tasa, arrendamientos del worker—, y un solo huérfano hace fallar el `VALIDATE`. Se recorre el catálogo en vez de escribir
-- la lista a mano: una tabla nueva con `tenant_id` queda cubierta sin tocar este fichero.
DO $$
DECLARE t text; insertados bigint; total bigint := 0;
BEGIN
 FOR t IN
  SELECT c.relname FROM pg_class c
   JOIN pg_namespace n ON n.oid=c.relnamespace
   JOIN information_schema.columns k ON k.table_schema='public' AND k.table_name=c.relname AND k.column_name='tenant_id'
  WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> 'tenants' AND c.relname NOT LIKE '%\_retirada\_%'
    -- Registros de INTENTOS de acceso: ver la nota de arriba. La integridad referencial aquí costaría la auditoría.
    AND c.relname NOT IN ('phi_access_log','session_revocations','access_decisions')
  ORDER BY c.relname
 LOOP
  EXECUTE format('INSERT INTO tenants(id,name) SELECT DISTINCT tenant_id,'''' FROM public.%I WHERE tenant_id IS NOT NULL ON CONFLICT (id) DO NOTHING',t);
  GET DIAGNOSTICS insertados = ROW_COUNT;
  total := total + insertados;
  IF insertados > 0 THEN RAISE NOTICE '0030: % tenants registrados desde %', insertados, t; END IF;
 END LOOP;
 RAISE NOTICE '0030: relleno completo, % tenants añadidos al registro', total;
END $$;

-- ---------- 2) El runtime REGISTRA el tenant en su primera escritura ----------
-- La 0029 no daba INSERT sobre `tenants` al rol de la aplicación, con el argumento de que dar de alta un consultorio es una
-- operación administrativa. Al añadir la clave foránea ese argumento se vuelve en contra: el `tenant_id` lo asigna el IdP, así
-- que un consultorio nuevo tendría una sesión válida y su PRIMERA escritura clínica sería rechazada por la restricción. Entre
-- romper el alta y permitir que el kernel registre lo que ya está escribiendo, lo segundo es lo correcto: el kernel hace
-- `ON CONFLICT DO NOTHING` dentro de la misma transacción del comando, de modo que el registro queda completo por
-- construcción. No es una concesión de privilegio nueva en términos de exposición: quien puede escribir un evento clínico ya
-- determinaba de hecho la existencia de ese tenant.
GRANT INSERT ON tenants TO medical_os_runtime;

-- ---------- 3) Las claves foráneas, sin validar ----------
DO $$
DECLARE t text; nombre text;
BEGIN
 FOR t IN
  SELECT c.relname FROM pg_class c
   JOIN pg_namespace n ON n.oid=c.relnamespace
   JOIN information_schema.columns k ON k.table_schema='public' AND k.table_name=c.relname AND k.column_name='tenant_id'
  WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> 'tenants' AND c.relname NOT LIKE '%\_retirada\_%'
    -- Registros de INTENTOS de acceso: ver la nota de arriba. La integridad referencial aquí costaría la auditoría.
    AND c.relname NOT IN ('phi_access_log','session_revocations','access_decisions')
  ORDER BY c.relname
 LOOP
  nombre := t||'_tenant_fk';
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname=nombre AND connamespace='public'::regnamespace) THEN
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenants(id) NOT VALID',t,nombre);
   RAISE NOTICE '0030: clave foránea añadida (sin validar) en %', t;
  END IF;
 END LOOP;
END $$;

-- ---------- 4) Validación, con el bloqueo que no detiene al consultorio ----------
-- `VALIDATE CONSTRAINT` escanea la tabla con SHARE UPDATE EXCLUSIVE: no bloquea lecturas ni escrituras. Si alguna fila
-- quedara huérfana a pesar del relleno, ESTA es la sentencia que falla, y falla con el nombre de la tabla: mejor que
-- descubrirlo con la restricción ya activa rechazando escrituras clínicas.
DO $$
DECLARE r record;
BEGIN
 FOR r IN
  SELECT conname, conrelid::regclass::text AS tabla FROM pg_constraint
  WHERE contype='f' AND connamespace='public'::regnamespace AND NOT convalidated AND conname LIKE '%\_tenant\_fk'
  ORDER BY conname
 LOOP
  EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I',r.tabla,r.conname);
 END LOOP;
END $$;

-- ---------- 5) Índice sobre la columna referenciante donde falta ----------
-- Una clave foránea no crea índice en el lado que referencia. Sin él, borrar o actualizar una fila de `tenants` fuerza un
-- escaneo secuencial de cada tabla hija para comprobar la restricción. Las tablas grandes ya tienen `tenant_id` como primera
-- columna de algún índice; se cubre el resto.
DO $$
DECLARE t text;
BEGIN
 FOR t IN
  SELECT c.relname FROM pg_class c
   JOIN pg_namespace n ON n.oid=c.relnamespace
   JOIN information_schema.columns k ON k.table_schema='public' AND k.table_name=c.relname AND k.column_name='tenant_id'
  WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> 'tenants' AND c.relname NOT LIKE '%\_retirada\_%'
    -- Registros de INTENTOS de acceso: ver la nota de arriba. La integridad referencial aquí costaría la auditoría.
    AND c.relname NOT IN ('phi_access_log','session_revocations','access_decisions')
    AND NOT EXISTS(
     SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
     WHERE i.indrelid=c.oid AND a.attname='tenant_id')
  ORDER BY c.relname
 LOOP
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(tenant_id)',t||'_tenant_idx',t);
  RAISE NOTICE '0030: índice de tenant_id creado en %', t;
 END LOOP;
END $$;
