# ADR-0130 — Failure-Driven Maturity
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
> · **Alternativas consideradas:** Madurez por calendario — el texto fija madurez dirigida por fallos.

v13 shifts validation toward hostile runtime conditions: crash boundaries, replay divergence,
worker fencing, tenant isolation and fail-closed release admission. No production claim is allowed
until dependency-backed tests and live PostgreSQL evidence exist.

> **Nota (auditoría R09-005, 2026-09-24).** El bloqueo de producción que declara este ADR sigue vigente, pero su lista de
> condiciones NO es la autoridad: tres ADR declaraban listas solapadas y ninguna decía dónde se comprueba cada condición ni
> quién la levanta, así que el bloqueo no se podía evaluar. La lista única, con el estado de cada condición y su
> verificación ejecutable, está en **ADR-0300**. Este texto se conserva como registro de lo que se decidió en v13.
