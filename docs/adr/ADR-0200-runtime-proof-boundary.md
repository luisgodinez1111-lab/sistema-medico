# ADR-0200 — Runtime Proof Boundary
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
> · **Alternativas consideradas:** Pruebas sin frontera de evidencia en ejecución — el texto fija la frontera.

v20 separates model evidence from runtime evidence. One million RLS model probes or hundreds of thousands
of crash scenarios can falsify logic, but cannot prove PostgreSQL role behavior, driver transactions, Next HTTP
parsing, restore correctness, or production performance. Release Admission V6 therefore refuses to upgrade
MODEL_PASS into RUNTIME_PASS. The next valid promotion requires a reproducible dependency graph and live
PostgreSQL/HTTP execution evidence.
