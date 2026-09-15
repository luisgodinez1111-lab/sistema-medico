# ADR-0160 — Deep Defect Elimination Before Feature Inflation
Status: ACCEPTED

v16 treats schema/runtime disagreement, unsafe migration evolution, hidden RLS assumptions, non-canonical hashing,
and evidence ambiguity as release-grade defects. Historical migrations remain immutable; repair migrations and
versioned canonical contracts supersede defective assumptions. Production remains blocked until live PostgreSQL,
dependency-backed tests and human safety/governance review exist.
