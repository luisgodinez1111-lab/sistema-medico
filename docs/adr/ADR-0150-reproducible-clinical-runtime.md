# ADR-0150 — Reproducible Clinical Runtime Before Feature Inflation
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
> · **Alternativas consideradas:** Un runtime no reproducible — el texto exige reproducibilidad.

v15 is a large integration jump, not a feature-count exercise. The release unit is a reproducible clinical runtime with explicit truth semantics, atomic write authority, tenant isolation, durable asynchronous consequences, correction propagation, owned obligations, policy provenance, bounded AI authority, append-only signed truth, recovery verification, performance budgets, chaos scenarios and cryptographically bound evidence. Production admission remains blocked until dependency-backed tests, live PostgreSQL/RLS attack tests, mapping adjudication, AI candidate reconciliation, defect assessment and C5 human safety review are completed.

> **Nota (auditoría R09-005, 2026-09-24).** El bloqueo de producción que declara este ADR sigue vigente, pero su lista de
> condiciones NO es la autoridad: tres ADR declaraban listas solapadas y ninguna decía dónde se comprueba cada condición ni
> quién la levanta, así que el bloqueo no se podía evaluar. La lista única, con el estado de cada condición y su
> verificación ejecutable, está en **ADR-0300**. Este texto se conserva como registro de lo que se decidió en v15.
