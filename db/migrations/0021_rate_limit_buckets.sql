-- Auditoría 2026-09-19 (S-03) — almacén COMPARTIDO del límite de tasa. Antes el estado de los cubos de tokens vivía en la
-- memoria de cada instancia (con N instancias el tope efectivo era ~N veces el declarado). Esta tabla guarda el cubo por
-- (ámbito, llave) y la función rate_limit_take() lo rellena y consume de forma ATÓMICA (una fila bloqueada por decisión).
-- No contiene PHI: las llaves son direcciones IP y hashes de sesión/actor; no lleva tenant_id (el límite de login es previo
-- al tenant). Consumidor: apps/web/lib/rate-limit-shared.ts.
BEGIN;
CREATE TABLE IF NOT EXISTS rate_limit_buckets(
 scope text NOT NULL,
 key text NOT NULL,
 tokens double precision NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(scope,key)
);
COMMENT ON TABLE rate_limit_buckets IS 'Cubos de tokens del límite de tasa compartido entre instancias (auditoría S-03). Sin PHI. Filas inactivas se purgan con rate_limit_gc().';
-- Toma un token del cubo (scope,key): rellena por el tiempo transcurrido hasta `cap` a razón de `refill` tokens/segundo,
-- consume uno si hay al menos uno y devuelve si se permitió y el saldo. Atómica: INSERT ... ON CONFLICT bloquea la fila.
CREATE OR REPLACE FUNCTION rate_limit_take(p_scope text, p_key text, p_cap double precision, p_refill double precision)
RETURNS TABLE(allowed boolean, tokens double precision) LANGUAGE plpgsql AS $$
DECLARE v_prev double precision; v_at timestamptz; v_refilled double precision;
BEGIN
 INSERT INTO rate_limit_buckets(scope,key,tokens,updated_at) VALUES(p_scope,p_key,p_cap,now())
  ON CONFLICT(scope,key) DO UPDATE SET tokens=rate_limit_buckets.tokens -- no-op que toma el bloqueo de fila
  RETURNING rate_limit_buckets.tokens, rate_limit_buckets.updated_at INTO v_prev, v_at;
 v_refilled := LEAST(p_cap, v_prev + GREATEST(0, EXTRACT(EPOCH FROM (now()-v_at))) * p_refill);
 IF v_refilled >= 1 THEN
  UPDATE rate_limit_buckets SET tokens=v_refilled-1, updated_at=now() WHERE scope=p_scope AND key=p_key;
  RETURN QUERY SELECT true, v_refilled-1;
 ELSE
  UPDATE rate_limit_buckets SET tokens=v_refilled, updated_at=now() WHERE scope=p_scope AND key=p_key;
  RETURN QUERY SELECT false, v_refilled;
 END IF;
END $$;
-- Limpieza de cubos inactivos (sin uso desde hace más de un día): la aplicación la invoca de forma oportunista.
CREATE OR REPLACE FUNCTION rate_limit_gc(max_age interval DEFAULT interval '1 day') RETURNS integer LANGUAGE sql AS $$
 WITH d AS (DELETE FROM rate_limit_buckets WHERE updated_at < now()-max_age RETURNING 1) SELECT count(*)::int FROM d;
$$;
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_buckets TO medical_os_runtime;
GRANT EXECUTE ON FUNCTION rate_limit_take(text,text,double precision,double precision), rate_limit_gc(interval) TO medical_os_runtime;
COMMIT;
