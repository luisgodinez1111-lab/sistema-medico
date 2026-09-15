# ADR-0200 — Runtime Proof Boundary
Status: ACCEPTED

v20 separates model evidence from runtime evidence. One million RLS model probes or hundreds of thousands
of crash scenarios can falsify logic, but cannot prove PostgreSQL role behavior, driver transactions, Next HTTP
parsing, restore correctness, or production performance. Release Admission V6 therefore refuses to upgrade
MODEL_PASS into RUNTIME_PASS. The next valid promotion requires a reproducible dependency graph and live
PostgreSQL/HTTP execution evidence.
