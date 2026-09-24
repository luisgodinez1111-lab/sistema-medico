# ADR-0130 — Failure-Driven Maturity
Status: ACCEPTED

v13 shifts validation toward hostile runtime conditions: crash boundaries, replay divergence,
worker fencing, tenant isolation and fail-closed release admission. No production claim is allowed
until dependency-backed tests and live PostgreSQL evidence exist.

> **Nota (auditoría R09-005, 2026-09-24).** El bloqueo de producción que declara este ADR sigue vigente, pero su lista de
> condiciones NO es la autoridad: tres ADR declaraban listas solapadas y ninguna decía dónde se comprueba cada condición ni
> quién la levanta, así que el bloqueo no se podía evaluar. La lista única, con el estado de cada condición y su
> verificación ejecutable, está en **ADR-0300**. Este texto se conserva como registro de lo que se decidió en v13.
