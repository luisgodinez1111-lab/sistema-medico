-- Hallazgo nuevo (2026-09-22, al aplicar 0019–0021 en producción; `pnpm db:check`): la base de producción tiene 32 tablas
-- que NINGUNA migración del repo creó (esquema FHIR-like en singular de una iteración anterior: patient, practitioner,
-- organization, membership, allergy, consent, observation, invoice…), con `tenant_id`, SIN RLS y con unas pocas filas de
-- demostración. El rol de la aplicación no tiene privilegios sobre ellas (no son alcanzables desde el código), pero un
-- esquema con PHI potencial sin aislamiento no puede quedar así. Esta migración las AÍSLA y las CIERRA si existen, sin
-- tocar sus datos: RLS forzada + política de tenant + revocación al rol de la app + comentario de estado. Su retirada
-- (DROP con respaldo) es una decisión del dueño (ADR-0240 §4, D-09). En bases nuevas (CI, pruebas en vivo) no hace nada.
BEGIN;
DO $$
DECLARE t text; n int := 0;
BEGIN
 FOREACH t IN ARRAY ARRAY['allergy','appointment','arco_request','audit_event','clinical_document','condition','consent','diagnostic_report','encounter','encounter_addendum','encounter_diagnosis','encounter_exam_finding','facility','history_entry','invoice','invoice_item','medication_request','membership','membership_role','observation','organization','patient','practitioner','procedure','provenance','related_person','relationship','role','role_permission','service_request','task','tenant_specialty'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='tenant_id') THEN
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
   EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
   EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_v22 ON public.%I', t);
   EXECUTE format('CREATE POLICY tenant_isolation_v22 ON public.%I USING (tenant_id=app.current_tenant()) WITH CHECK (tenant_id=app.current_tenant())', t);
   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='medical_os_runtime') THEN
    EXECUTE format('REVOKE ALL ON public.%I FROM medical_os_runtime', t);
   END IF;
   EXECUTE format('COMMENT ON TABLE public.%I IS %L', t, 'LEGADO AJENO AL REPO (hallazgo 2026-09-22): tabla de una iteración anterior, no creada por db/migrations ni usada por la aplicación. Aislada por tenant y cerrada al rol de la app en 0022. Retirada pendiente de decisión del dueño (ADR-0240 §4).');
   n := n + 1;
  END IF;
 END LOOP;
 RAISE NOTICE '0022: % tablas heredadas aisladas', n;
END $$;
COMMIT;
