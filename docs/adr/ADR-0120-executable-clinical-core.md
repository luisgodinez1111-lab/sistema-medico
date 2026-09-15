# ADR-0120 — Executable Clinical Core
Status: ACCEPTED

v12 stops treating the Golden Slice as a diagram. It introduces executable domain runtimes for encounter,
obligation, medication, corrected-result lineage, patient-impact discovery, projections, leased outbox work,
runtime authorization, idempotent command admission and a scoped PostgreSQL transaction adapter.

The repository still does not claim production readiness: dependency-backed Vitest, a real PostgreSQL execution,
human mapping adjudication, defect assessment and C5 clinical safety approval remain mandatory blockers.
