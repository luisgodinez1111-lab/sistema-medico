# ADR-0030 — Modular Monolith First, Service Extraction by Evidence
Status: ACCEPTED

Medical OS will not use microservices as a prestige architecture. The clinical kernel begins as strongly bounded packages over one transactional Postgres authority. Services are extracted only when isolation, scaling, regulatory boundary, team ownership, or failure containment is demonstrated. This reduces distributed failure modes while preserving event/outbox seams for later extraction.
