# ADR-0031 — Clinical Events + Transactional Outbox
Status: ACCEPTED

Clinically consequential state changes use transactional state + outbox semantics. Async consumers are idempotent. Partial delivery is detectable, retryable, reconcilable, and dead-lettered rather than silently lost.
