# ADR-0120 — Executable Clinical Core
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
> · **Alternativas consideradas:** Un núcleo clínico documental — el texto exige núcleo ejecutable.

v12 stops treating the Golden Slice as a diagram. It introduces executable domain runtimes for encounter,
obligation, medication, corrected-result lineage, patient-impact discovery, projections, leased outbox work,
runtime authorization, idempotent command admission and a scoped PostgreSQL transaction adapter.

The repository still does not claim production readiness: dependency-backed Vitest, a real PostgreSQL execution,
human mapping adjudication, defect assessment and C5 clinical safety approval remain mandatory blockers.
