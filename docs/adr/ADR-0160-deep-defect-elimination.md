# ADR-0160 — Deep Defect Elimination Before Feature Inflation
Status: ACCEPTED

v16 treats schema/runtime disagreement, unsafe migration evolution, hidden RLS assumptions, non-canonical hashing,
and evidence ambiguity as release-grade defects. Historical migrations remain immutable; repair migrations and
versioned canonical contracts supersede defective assumptions. Production remains blocked until live PostgreSQL,
dependency-backed tests and human safety/governance review exist.

> **Nota (auditoría R09-005, 2026-09-24).** El bloqueo de producción que declara este ADR sigue vigente, pero su lista de
> condiciones NO es la autoridad: tres ADR declaraban listas solapadas y ninguna decía dónde se comprueba cada condición ni
> quién la levanta, así que el bloqueo no se podía evaluar. La lista única, con el estado de cada condición y su
> verificación ejecutable, está en **ADR-0300**. Este texto se conserva como registro de lo que se decidió en v16.
