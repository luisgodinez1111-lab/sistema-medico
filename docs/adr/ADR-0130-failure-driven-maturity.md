# ADR-0130 — Failure-Driven Maturity
Status: ACCEPTED

v13 shifts validation toward hostile runtime conditions: crash boundaries, replay divergence,
worker fencing, tenant isolation and fail-closed release admission. No production claim is allowed
until dependency-backed tests and live PostgreSQL evidence exist.
