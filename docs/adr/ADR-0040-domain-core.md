# ADR-0040 — Manufacturable Clinical Domain Core
Status: ACCEPTED

v4 converts architectural boundaries into domain packages with executable state rules and a relational persistence baseline.
The database remains an authority boundary, not a passive storage bucket. Critical domain state must have explicit versioning,
legal transitions, provenance/authority, and fail-closed semantics.
