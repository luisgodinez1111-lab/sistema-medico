# ADR-0040 — Manufacturable Clinical Domain Core
Status: ACCEPTED — cláusula de persistencia ENMENDADA por ADR-0240 (ver nota al pie)

v4 converts architectural boundaries into domain packages with executable state rules and a relational persistence baseline.
The database remains an authority boundary, not a passive storage bucket. Critical domain state must have explicit versioning,
legal transitions, provenance/authority, and fail-closed semantics.

## Nota de enmienda (auditoría 2026-09-19, anexo R09-001 — 2026-09-24)

Este ADR exige una **«relational persistence baseline»** y el código no la tiene: toda la verdad clínica vive en
`clinical_events.payload` (jsonb), por decisión de **ADR-0240**, que es posterior y también está ACEPTADO. Dos ADR aceptados
en contradicción, sin sucesión registrada, son peores que ninguno: quien lea este fichero creerá que el sistema persiste en
tablas relacionales versionadas. La cláusula queda **enmendada por ADR-0240 §1**.

Lo que este ADR pedía de fondo NO se abandonó; se cumple en otro sitio, y por eso la enmienda no es una rebaja:

- **versionado explícito del estado de dominio** → `aggregate_versions` con concurrencia optimista (409 en conflicto real,
  probado en `scripts/v22/live-concurrency-and-audit-vector-proof.mts`);
- **transiciones legales** → los folds puros por agregado (`packages/*-fold`, `*-lifecycle`), donde un `kind` desconocido es
  `INVARIANT_VIOLATION`;
- **procedencia y autoridad** → columnas `actor_id`, `actor_type` y `authority` en cada evento, más la cadena
  `audit_chain_v3` encadenada por hash;
- **semántica fail-closed** → el kernel rechaza antes de abrir la transacción (contexto de tenant, esquema del payload,
  sesión revocada) y ningún error mapea a 2xx.

Las tablas relacionales de dominio que este ADR inspiró siguen en el esquema sin lector ni escritor, aisladas en la
migración 0020; su retiro es la decisión del dueño que ADR-0240 §4 registra.
