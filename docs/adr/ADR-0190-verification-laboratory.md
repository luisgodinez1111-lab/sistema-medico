# ADR-0190 — Verification Laboratory
Status: ACCEPTED

v19 measures progress by attempted falsification and evidence closure, not capability count. A release claim
is incomplete when its authority, invariant, executed environment, human review, or dependency evidence is open.
Large deterministic corpora and differential replay provide useful evidence but never substitute for live
PostgreSQL, dependency-backed execution, real HTTP fuzzing, restore drills, performance tests, or human C5 review.
