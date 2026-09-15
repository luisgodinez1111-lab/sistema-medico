# ADR-0210 — Physical Runtime Evidence Is a Separate Authority Class
Status: ACCEPTED

v21 introduces executable PostgreSQL/RLS proof harnesses and hashed command evidence. The harnesses refuse
to claim success without TEST_DATABASE_URL. In the current artifact environment no PostgreSQL server/client
or container runtime is available, so live database evidence remains NOT_RUN rather than being simulated.
A package lock generation attempt is separately recorded and never treated as an installed dependency graph.
