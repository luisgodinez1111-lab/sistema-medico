# ADR-0170 — Transaction Ownership Is a Safety Property
Status: ACCEPTED


> **Encabezado de gobierno añadido el 2026-10-06 (auditoría R09-003).** El ADR original no declaraba fecha, autor ni
> alternativas. Lo que sigue se DERIVA de evidencia verificable o se declara ausente; **nada se reconstruye de memoria**:
> inventar una fecha de decisión o un decisor sería fabricar un registro de gobierno, que es justo el defecto que esta
> auditoría persigue en otros sitios (la tabla de firmas C5 vacía, `Mapping_Adjudication.csv` con cero filas).
>
> · **Fecha de incorporación al repositorio:** 2026-09-15 (del historial de git, `--diff-filter=A`). **No es la fecha de la
>   decisión**, que no consta en ninguna parte.
> · **Decidido por:** **no consta.** El repositorio registra quién hizo el commit, no quién tomó la decisión, y son cosas
>   distintas. Lo llena el dueño del producto; hasta entonces este ADR documenta una decisión sin decisor registrado.
> · **Alternativas consideradas:** Múltiples autoridades transaccionales — el texto fija una sola.

A function that performs several SQL statements is not atomic merely because it is named a unit of work. v17 requires the authoritative clinical command path itself to open and own the PostgreSQL transaction. Idempotency claim, aggregate compare-and-swap, clinical event, transactional outbox, serialized audit append, and idempotency completion execute inside the same transaction callback. Historical V1/V2 implementations are retired from production imports rather than deleted, preserving evidence of prior defects.
