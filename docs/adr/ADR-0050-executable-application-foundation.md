# ADR-0050 — Executable Application Foundation
Status: ACCEPTED

v5 establishes an actual web/application/worker/persistence seam rather than treating domain packages as the product.
The web shell must not bypass application services, authorization, tenant isolation, domain rules, or evidence gates.
Database RLS is defense-in-depth and never substitutes for application authorization.
