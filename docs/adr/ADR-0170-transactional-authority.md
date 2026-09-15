# ADR-0170 — Transaction Ownership Is a Safety Property
Status: ACCEPTED

A function that performs several SQL statements is not atomic merely because it is named a unit of work. v17 requires the authoritative clinical command path itself to open and own the PostgreSQL transaction. Idempotency claim, aggregate compare-and-swap, clinical event, transactional outbox, serialized audit append, and idempotency completion execute inside the same transaction callback. Historical V1/V2 implementations are retired from production imports rather than deleted, preserving evidence of prior defects.
